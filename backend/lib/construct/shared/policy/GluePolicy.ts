import * as iam from "aws-cdk-lib/aws-iam";

export class GluePolicy {
  /**
   * Policy for Glue service role with comprehensive permissions
   */
  static getGlueServiceRolePolicy(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "glue:GetDatabase",
        "glue:GetDatabases",
        "glue:CreateTable",
        "glue:UpdateTable",
        "glue:DeleteTable",
        "glue:GetTable",
        "glue:GetTables",
        "glue:GetPartition",
        "glue:GetPartitions",
        "glue:CreatePartition",
        "glue:UpdatePartition",
        "glue:DeletePartition",
        "glue:BatchCreatePartition",
        "glue:BatchDeletePartition",
        "glue:BatchUpdatePartition",
        "glue:GetConnection",
        "glue:GetConnections",
        "glue:GetCrawler",
        "glue:GetCrawlers",
        "glue:GetJob",
        "glue:GetJobs",
        "glue:GetJobRun",
        "glue:GetJobRuns",
        "glue:StartJobRun",
        "glue:BatchStopJobRun",
        "glue:GetWorkflow",
        "glue:GetWorkflows",
        "glue:GetWorkflowRun",
        "glue:GetWorkflowRuns",
        "glue:StartWorkflowRun",
        "glue:StopWorkflowRun",
      ],
      resources: ["*"],
    });
  }

  /**
   * Policy for S3 access required by Glue jobs
   */
  static getS3AccessPolicy(bucketArns: string[]): iam.PolicyStatement {
    const resources = bucketArns.flatMap(arn => [arn, `${arn}/*`]);
    
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:ListAllMyBuckets",
        "s3:GetBucketVersioning",
        "s3:GetBucketAcl",
        "s3:GetBucketPolicy",
      ],
      resources: resources,
    });
  }

  /**
   * Policy for Aurora database access via JDBC
   */
  static getAuroraJdbcAccessPolicy(clusterArn: string, secretArn: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "rds:DescribeDBClusters",
        "rds:DescribeDBInstances",
        "rds:DescribeDBClusterParameters",
        "rds:DescribeDBParameters",
        "rds:ListTagsForResource",
      ],
      resources: [clusterArn],
    });
  }

  /**
   * Policy for RDS Data API access (alternative to JDBC)
   */
  static getRdsDataApiPolicy(clusterArn: string, secretArn: string): iam.PolicyStatement {
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
   * Policy for Secrets Manager access
   */
  static getSecretsManagerPolicy(secretArns: string[]): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
      ],
      resources: secretArns,
    });
  }

  /**
   * Policy for VPC and networking access
   */
  static getVpcAccessPolicy(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "ec2:CreateNetworkInterface",
        "ec2:DeleteNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DescribeVpcs",
        "ec2:DescribeSubnets",
        "ec2:DescribeSecurityGroups",
        "ec2:AttachNetworkInterface",
        "ec2:DetachNetworkInterface",
        "ec2:CreateTags",
        "ec2:DeleteTags",
      ],
      resources: ["*"],
    });
  }

  /**
   * Policy for CloudWatch Logs access
   */
  static getCloudWatchLogsPolicy(logGroupArns?: string[]): iam.PolicyStatement {
    const resources = logGroupArns || [
      "arn:aws:logs:*:*:log-group:/aws-glue/*",
      "arn:aws:logs:*:*:log-group:/aws-glue/*:*",
    ];

    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:GetLogEvents",
      ],
      resources: resources,
    });
  }

  /**
   * Policy for CloudWatch metrics
   */
  static getCloudWatchMetricsPolicy(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "cloudwatch:PutMetricData",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics",
      ],
      resources: ["*"],
      conditions: {
        StringEquals: {
          "cloudwatch:namespace": ["AWS/Glue", "Glue"],
        },
      },
    });
  }

  /**
   * Policy for KMS encryption/decryption
   */
  static getKmsPolicy(kmsKeyArns?: string[]): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "kms:Decrypt",
        "kms:Encrypt",
        "kms:GenerateDataKey",
        "kms:ReEncryptFrom",
        "kms:ReEncryptTo",
        "kms:CreateGrant",
        "kms:DescribeKey",
      ],
      resources: kmsKeyArns || ["*"],
    });
  }

  /**
   * Policy for Glue job bookmarks
   */
  static getJobBookmarksPolicy(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "glue:GetJobBookmark",
        "glue:GetJobBookmarks",
        "glue:UpdateJobBookmark",
        "glue:ResetJobBookmark",
      ],
      resources: ["*"],
    });
  }

  /**
   * Policy for Glue crawler operations
   */
  static getCrawlerPolicy(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "glue:StartCrawler",
        "glue:StopCrawler",
        "glue:GetCrawler",
        "glue:GetCrawlers",
        "glue:GetCrawlerMetrics",
        "glue:BatchGetCrawlers",
        "glue:UpdateCrawler",
        "glue:CreateCrawler",
        "glue:DeleteCrawler",
      ],
      resources: ["*"],
    });
  }

  /**
   * Policy for Glue workflow operations
   */
  static getWorkflowPolicy(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "glue:GetWorkflow",
        "glue:GetWorkflows",
        "glue:GetWorkflowRun",
        "glue:GetWorkflowRuns",
        "glue:StartWorkflowRun",
        "glue:StopWorkflowRun",
        "glue:ResumeWorkflowRun",
        "glue:GetWorkflowRunProperties",
        "glue:PutWorkflowRunProperties",
      ],
      resources: ["*"],
    });
  }

  /**
   * Policy for Glue Data Quality operations
   */
  static getDataQualityPolicy(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "glue:GetDataQualityRuleset",
        "glue:GetDataQualityRulesets",
        "glue:CreateDataQualityRuleset",
        "glue:UpdateDataQualityRuleset",
        "glue:DeleteDataQualityRuleset",
        "glue:GetDataQualityResult",
        "glue:BatchGetDataQualityResult",
        "glue:StartDataQualityRulesetEvaluationRun",
        "glue:CancelDataQualityRulesetEvaluationRun",
        "glue:GetDataQualityRulesetEvaluationRun",
        "glue:ListDataQualityRulesetEvaluationRuns",
      ],
      resources: ["*"],
    });
  }

  /**
   * Comprehensive policy for Glue ETL jobs with Aurora and S3 access
   */
  static getEtlJobPolicy(
    clusterArn: string,
    secretArns: string[],
    bucketArns: string[],
    kmsKeyArns?: string[]
  ): iam.PolicyStatement[] {
    return [
      this.getGlueServiceRolePolicy(),
      this.getS3AccessPolicy(bucketArns),
      this.getAuroraJdbcAccessPolicy(clusterArn, secretArns[0]),
      this.getRdsDataApiPolicy(clusterArn, secretArns[0]),
      this.getSecretsManagerPolicy(secretArns),
      this.getVpcAccessPolicy(),
      this.getCloudWatchLogsPolicy(),
      this.getCloudWatchMetricsPolicy(),
      this.getJobBookmarksPolicy(),
      ...(kmsKeyArns ? [this.getKmsPolicy(kmsKeyArns)] : []),
    ];
  }

  /**
   * Comprehensive policy for Glue crawlers with Aurora and S3 access
   */
  static getCrawlerFullPolicy(
    clusterArn: string,
    secretArns: string[],
    bucketArns: string[],
    kmsKeyArns?: string[]
  ): iam.PolicyStatement[] {
    return [
      this.getGlueServiceRolePolicy(),
      this.getCrawlerPolicy(),
      this.getS3AccessPolicy(bucketArns),
      this.getAuroraJdbcAccessPolicy(clusterArn, secretArns[0]),
      this.getSecretsManagerPolicy(secretArns),
      this.getVpcAccessPolicy(),
      this.getCloudWatchLogsPolicy(),
      this.getCloudWatchMetricsPolicy(),
      ...(kmsKeyArns ? [this.getKmsPolicy(kmsKeyArns)] : []),
    ];
  }

  /**
   * Comprehensive policy for Glue workflows
   */
  static getWorkflowFullPolicy(
    clusterArn: string,
    secretArns: string[],
    bucketArns: string[],
    kmsKeyArns?: string[]
  ): iam.PolicyStatement[] {
    return [
      this.getGlueServiceRolePolicy(),
      this.getWorkflowPolicy(),
      this.getCrawlerPolicy(),
      this.getJobBookmarksPolicy(),
      this.getS3AccessPolicy(bucketArns),
      this.getAuroraJdbcAccessPolicy(clusterArn, secretArns[0]),
      this.getRdsDataApiPolicy(clusterArn, secretArns[0]),
      this.getSecretsManagerPolicy(secretArns),
      this.getVpcAccessPolicy(),
      this.getCloudWatchLogsPolicy(),
      this.getCloudWatchMetricsPolicy(),
      ...(kmsKeyArns ? [this.getKmsPolicy(kmsKeyArns)] : []),
    ];
  }

  /**
   * Policy for Glue development endpoints (for testing and development)
   */
  static getDevEndpointPolicy(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "glue:CreateDevEndpoint",
        "glue:DeleteDevEndpoint",
        "glue:GetDevEndpoint",
        "glue:GetDevEndpoints",
        "glue:UpdateDevEndpoint",
        "glue:StartDevEndpoint",
        "glue:StopDevEndpoint",
      ],
      resources: ["*"],
    });
  }

  /**
   * Policy for Glue ML transforms
   */
  static getMlTransformPolicy(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "glue:CreateMLTransform",
        "glue:DeleteMLTransform",
        "glue:GetMLTransform",
        "glue:GetMLTransforms",
        "glue:UpdateMLTransform",
        "glue:StartMLEvaluationTaskRun",
        "glue:StartMLLabelingSetGenerationTaskRun",
        "glue:GetMLTaskRun",
        "glue:GetMLTaskRuns",
        "glue:CancelMLTaskRun",
      ],
      resources: ["*"],
    });
  }
}
