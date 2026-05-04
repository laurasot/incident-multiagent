import * as iam from "aws-cdk-lib/aws-iam";

export class DmsPolicy {
  /**
   * Policy for DMS service role with comprehensive permissions
   */
  static getDmsServiceRolePolicy(projectName: string, environment: string): iam.PolicyDocument {
    return new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'secretsmanager:GetSecretValue',
            'secretsmanager:DescribeSecret',
          ],
          resources: [
            `arn:aws:secretsmanager:*:*:secret:${projectName}-aurora-*`,
            `arn:aws:secretsmanager:*:*:secret:${projectName}-redshift-*`,
          ],
          conditions: {
            StringEquals: {
              'secretsmanager:ResourceTag/Project': projectName,
              'secretsmanager:ResourceTag/Environment': environment,
            },
          },
        }),
        
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
            's3:ListBucket',
            's3:GetBucketLocation',
            's3:GetBucketVersioning',
            's3:GetObjectVersion',
            's3:PutObjectAcl',
          ],
          resources: [
            `arn:aws:s3:::${projectName}-dms-temp-${environment}`.toLowerCase(),
            `arn:aws:s3:::${projectName}-dms-temp-${environment}/*`.toLowerCase(),
            `arn:aws:s3:::${projectName}-*-${environment}`.toLowerCase(),
            `arn:aws:s3:::${projectName}-*-${environment}/*`.toLowerCase(),
          ],
        }),
        
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'kms:Decrypt',
            'kms:DescribeKey',
            'kms:Encrypt',
            'kms:GenerateDataKey',
            'kms:GenerateDataKeyWithoutPlaintext',
            'kms:ReEncryptFrom',
            'kms:ReEncryptTo',
          ],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'kms:ViaService': [
                `s3.*.amazonaws.com`,
                `rds.*.amazonaws.com`,
                `redshift.*.amazonaws.com`,
              ],
            },
          },
        }),
        
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents',
            'logs:DescribeLogGroups',
            'logs:DescribeLogStreams',
          ],
          resources: [
            `arn:aws:logs:*:*:log-group:/aws/dms/*`,
            `arn:aws:logs:*:*:log-group:dms-tasks-*`,
          ],
        }),
        
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'cloudwatch:PutMetricData',
            'cloudwatch:GetMetricStatistics',
            'cloudwatch:ListMetrics',
          ],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'cloudwatch:namespace': 'AWS/DMS',
            },
          },
        }),
        
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'redshift:DescribeClusters',
            'redshift:DescribeClusterSubnetGroups',
            'redshift:DescribeClusterParameterGroups',
            'redshift:DescribeClusterSecurityGroups',
            'redshift-serverless:GetNamespace',
            'redshift-serverless:GetWorkgroup',
            'redshift-serverless:ListNamespaces',
            'redshift-serverless:ListWorkgroups',
          ],
          resources: [
            `arn:aws:redshift:*:*:cluster:${projectName}-*`,
            `arn:aws:redshift-serverless:*:*:namespace/*`,
            `arn:aws:redshift-serverless:*:*:workgroup/*`,
          ],
        }),
        
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'rds:DescribeDBInstances',
            'rds:DescribeDBClusters',
            'rds:DescribeDBSubnetGroups',
            'rds:DescribeDBParameterGroups',
            'rds:DescribeDBClusterParameterGroups',
            'rds:ListTagsForResource',
          ],
          resources: [
            `arn:aws:rds:*:*:cluster:${projectName}-*`,
            `arn:aws:rds:*:*:db:${projectName}-*`,
            `arn:aws:rds:*:*:subgrp:${projectName}-*`,
            `arn:aws:rds:*:*:pg:${projectName}-*`,
            `arn:aws:rds:*:*:cluster-pg:${projectName}-*`,
          ],
        }),
      ],
    });
  }

  /**
   * Policy for DMS VPC management role
   */
  static getDmsVpcManagementPolicy(): iam.PolicyDocument {
    return new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'ec2:CreateNetworkInterface',
            'ec2:DescribeAvailabilityZones',
            'ec2:DescribeInternetGateways',
            'ec2:DescribeSecurityGroups',
            'ec2:DescribeSubnets',
            'ec2:DescribeVpcs',
            'ec2:DeleteNetworkInterface',
            'ec2:ModifyNetworkInterfaceAttribute',
          ],
          resources: ['*'],
        }),
      ],
    });
  }

  /**
   * Policy for DMS CloudWatch logs role
   */
  static getDmsCloudWatchLogsPolicy(): iam.PolicyDocument {
    return new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents',
            'logs:DescribeLogGroups',
            'logs:DescribeLogStreams',
          ],
          resources: [
            'arn:aws:logs:*:*:log-group:/aws/dms/*',
            'arn:aws:logs:*:*:log-group:dms-tasks-*',
          ],
        }),
      ],
    });
  }

  /**
   * Policy for Lambda functions that manage DMS tasks
   */
  static getDmsLambdaManagementPolicy(projectName: string, environment: string): iam.PolicyDocument {
    return new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'dms:CreateReplicationTask',
            'dms:DeleteReplicationTask',
            'dms:DescribeReplicationTasks',
            'dms:StartReplicationTask',
            'dms:StopReplicationTask',
            'dms:ModifyReplicationTask',
            'dms:ReloadTables',
            'dms:TestConnection',
          ],
          resources: [
            `arn:aws:dms:*:*:task:${projectName}-*`,
            `arn:aws:dms:*:*:endpoint:${projectName}-*`,
            `arn:aws:dms:*:*:rep:${projectName}-*`,
          ],
        }),
        
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'dms:DescribeEndpoints',
            'dms:DescribeReplicationInstances',
            'dms:DescribeReplicationSubnetGroups',
            'dms:DescribeTableStatistics',
            'dms:DescribeReplicationTaskAssessmentResults',
          ],
          resources: ['*'],
        }),
        
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'dms:CreateReplicationConfig',
            'dms:DeleteReplicationConfig',
            'dms:DescribeReplicationConfigs',
            'dms:ModifyReplicationConfig',
            'dms:StartReplication',
            'dms:StopReplication',
          ],
          resources: [
            `arn:aws:dms:*:*:replication-config:*`,
          ],
        }),
        
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'dms:DescribeReplications',
          ],
          resources: ['*'],
        }),
      ],
    });
  }

  /**
   * Policy for Glue jobs that work with DMS
   */
  static getDmsGlueIntegrationPolicy(projectName: string, environment: string): iam.PolicyDocument {
    return new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'dms:DescribeReplicationTasks',
            'dms:DescribeTableStatistics',
            'dms:DescribeReplicationTaskAssessmentResults',
          ],
          resources: [
            `arn:aws:dms:*:*:task:${projectName}-*`,
          ],
        }),
        
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:ListBucket',
            's3:GetBucketLocation',
          ],
          resources: [
            `arn:aws:s3:::${projectName}-dms-temp-${environment}`.toLowerCase(),
            `arn:aws:s3:::${projectName}-dms-temp-${environment}/*`.toLowerCase(),
          ],
        }),
      ],
    });
  }

  /**
   * Policy for monitoring and alerting on DMS tasks
   */
  static getDmsMonitoringPolicy(projectName: string): iam.PolicyDocument {
    return new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'dms:DescribeReplicationTasks',
            'dms:DescribeReplicationInstances',
            'dms:DescribeTableStatistics',
            'dms:DescribeReplicationTaskAssessmentResults',
            'dms:DescribeReplicationConfigs',
          ],
          resources: ['*'],
        }),
        
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'cloudwatch:GetMetricStatistics',
            'cloudwatch:ListMetrics',
            'cloudwatch:PutMetricAlarm',
            'cloudwatch:DeleteAlarms',
            'cloudwatch:DescribeAlarms',
          ],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'cloudwatch:namespace': 'AWS/DMS',
            },
          },
        }),
        
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'logs:DescribeLogGroups',
            'logs:DescribeLogStreams',
            'logs:GetLogEvents',
            'logs:FilterLogEvents',
          ],
          resources: [
            'arn:aws:logs:*:*:log-group:/aws/dms/*',
            'arn:aws:logs:*:*:log-group:dms-tasks-*',
          ],
        }),
      ],
    });
  }

  /**
   * Comprehensive DMS policy for administrative operations
   */
  static getDmsAdminPolicy(projectName: string, environment: string): iam.PolicyDocument {
    return new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'dms:*',
          ],
          resources: [
            `arn:aws:dms:*:*:*:${projectName}-*`,
          ],
        }),
        
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'dms:Describe*',
            'dms:List*',
          ],
          resources: ['*'],
        }),
        
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'iam:PassRole',
          ],
          resources: [
            `arn:aws:iam::*:role/${projectName}-dms-*-${environment}`,
            `arn:aws:iam::*:role/dms-*-${projectName}-${environment}`,
          ],
          conditions: {
            StringEquals: {
              'iam:PassedToService': 'dms.amazonaws.com',
            },
          },
        }),
      ],
    });
  }
}
