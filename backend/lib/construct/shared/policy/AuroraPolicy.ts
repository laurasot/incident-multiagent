import * as iam from "aws-cdk-lib/aws-iam";

export class AuroraPolicy {
  /**
   * Policy for Lambda functions to access Aurora Data API
   */
  static getDataApiAccessPolicy(clusterArn: string, secretArn: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "rds-data:BatchExecuteStatement",
        "rds-data:BeginTransaction",
        "rds-data:CommitTransaction",
        "rds-data:ExecuteStatement",
        "rds-data:RollbackTransaction",
      ],
      resources: [clusterArn],
      conditions: {
        StringEquals: {
          "rds-data:StatementArn": secretArn,
        },
      },
    });
  }

  /**
   * Policy for accessing Aurora cluster secrets
   */
  static getSecretAccessPolicy(secretArn: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
      ],
      resources: [secretArn],
    });
  }

  /**
   * Policy for Aurora cluster monitoring and management
   */
  static getClusterManagementPolicy(clusterArn: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "rds:DescribeDBClusters",
        "rds:DescribeDBClusterParameters",
        "rds:DescribeDBInstances",
        "rds:ListTagsForResource",
      ],
      resources: [clusterArn],
    });
  }

  /**
   * Policy for CloudWatch metrics and logs access
   */
  static getMonitoringPolicy(clusterIdentifier: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
      ],
      resources: [
        `arn:aws:cloudwatch:*:*:metric/AWS/RDS/*`,
        `arn:aws:logs:*:*:log-group:/aws/rds/cluster/${clusterIdentifier}/*`,
      ],
    });
  }

  /**
   * Policy for VPC and networking access (for Lambda functions in VPC)
   */
  static getVpcAccessPolicy(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "ec2:CreateNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DeleteNetworkInterface",
        "ec2:AttachNetworkInterface",
        "ec2:DetachNetworkInterface",
      ],
      resources: ["*"],
    });
  }

  /**
   * Comprehensive policy for Lambda functions that need full Aurora access
   */
  static getLambdaAuroraPolicy(
    clusterArn: string,
    secretArn: string,
    clusterIdentifier: string
  ): iam.PolicyStatement[] {
    return [
      this.getDataApiAccessPolicy(clusterArn, secretArn),
      this.getSecretAccessPolicy(secretArn),
      this.getClusterManagementPolicy(clusterArn),
      this.getMonitoringPolicy(clusterIdentifier),
      this.getVpcAccessPolicy(),
    ];
  }

  /**
   * Policy for Aurora Serverless v2 auto-scaling
   */
  static getAutoScalingPolicy(clusterArn: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "application-autoscaling:RegisterScalableTarget",
        "application-autoscaling:DeregisterScalableTarget",
        "application-autoscaling:DescribeScalableTargets",
        "application-autoscaling:PutScalingPolicy",
        "application-autoscaling:DescribeScalingPolicies",
        "application-autoscaling:DeleteScalingPolicy",
      ],
      resources: [
        `arn:aws:application-autoscaling:*:*:scalable-target/rds:cluster:${clusterArn.split(':').pop()}`,
      ],
    });
  }

  /**
   * Policy for backup and restore operations
   */
  static getBackupPolicy(clusterArn: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "rds:CreateDBClusterSnapshot",
        "rds:DeleteDBClusterSnapshot",
        "rds:DescribeDBClusterSnapshots",
        "rds:RestoreDBClusterFromSnapshot",
        "rds:CopyDBClusterSnapshot",
      ],
      resources: [
        clusterArn,
        `${clusterArn.replace(':cluster:', ':cluster-snapshot:')}*`,
      ],
    });
  }
}
