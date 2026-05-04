import * as iam from "aws-cdk-lib/aws-iam";

// Policy statement for Lambda functions to access Redshift
export const redshiftPolicy = new iam.PolicyStatement({
  actions: [
    "redshift-serverless:GetWorkgroup",
    "redshift-serverless:GetNamespace",
    "redshift-data:ExecuteStatement",
    "redshift-data:GetStatementResult",
    "redshift-data:DescribeStatement",
  ],
  resources: ["*"],
});

export class RedshiftPolicy {
  /**
   * Policy for Redshift Serverless to access S3 buckets
   */
  static getRedshiftS3AccessPolicy(bucketArns: string[]): iam.PolicyDocument {
    return new iam.PolicyDocument({
      statements: [
        // S3 bucket access for data loading/unloading
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:GetObjectVersion',
            's3:ListBucket',
            's3:GetBucketLocation',
            's3:ListBucketMultipartUploads',
            's3:ListMultipartUploadParts',
            's3:PutObject',
            's3:DeleteObject',
            's3:AbortMultipartUpload',
          ],
          resources: [
            ...bucketArns,
            ...bucketArns.map(arn => `${arn}/*`),
          ],
        }),
        
        // Additional S3 permissions for Redshift Spectrum (if needed)
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:ListAllMyBuckets',
          ],
          resources: ['*'],
        }),
      ],
    });
  }

  /**
   * Policy for Redshift Serverless comprehensive access
   */
  static getRedshiftServerlessPolicy(projectName: string, environment: string, bucketArns: string[]): iam.PolicyDocument {
    const statements: iam.PolicyStatement[] = [
      // S3 bucket access for data loading/unloading
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3:GetObject',
          's3:GetObjectVersion',
          's3:ListBucket',
          's3:GetBucketLocation',
          's3:ListBucketMultipartUploads',
          's3:ListMultipartUploadParts',
          's3:PutObject',
          's3:DeleteObject',
          's3:AbortMultipartUpload',
        ],
        resources: [
          ...bucketArns,
          ...bucketArns.map(arn => `${arn}/*`),
        ],
      }),
      
      // Additional S3 permissions for Redshift Spectrum (if needed)
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3:ListAllMyBuckets',
        ],
        resources: ['*'],
      }),
      
      // CloudWatch Logs access for query logging
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
          `arn:aws:logs:*:*:log-group:/aws/redshift/serverless/${projectName}-${environment}*`,
        ],
      }),
      
      // Glue Catalog access for Redshift Spectrum
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'glue:GetDatabase',
          'glue:GetDatabases',
          'glue:GetTable',
          'glue:GetTables',
          'glue:GetPartition',
          'glue:GetPartitions',
          'glue:BatchCreatePartition',
          'glue:BatchDeletePartition',
          'glue:BatchUpdatePartition',
        ],
        resources: [
          `arn:aws:glue:*:*:catalog`,
          `arn:aws:glue:*:*:database/${projectName}_*`,
          `arn:aws:glue:*:*:table/${projectName}_*/*`,
        ],
      }),
    ];

    return new iam.PolicyDocument({
      statements,
    });
  }

  /**
   * Create IAM role for Redshift Serverless
   */
  static createRedshiftServerlessRole(
    scope: any,
    id: string,
    projectName: string,
    environment: string,
    bucketArns: string[]
  ): iam.Role {
    return new iam.Role(scope, id, {
      roleName: `${projectName}-redshift-serverless-role-${environment}`,
      assumedBy: new iam.ServicePrincipal('redshift.amazonaws.com'),
      description: `IAM role for Redshift Serverless cluster - ${projectName} ${environment}`,
      managedPolicies: [
        // AWS managed policy for Redshift
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonRedshiftAllCommandsFullAccess'),
      ],
      inlinePolicies: {
        RedshiftServerlessCustomPolicy: RedshiftPolicy.getRedshiftServerlessPolicy(
          projectName,
          environment,
          bucketArns
        ),
      },
    });
  }
}
