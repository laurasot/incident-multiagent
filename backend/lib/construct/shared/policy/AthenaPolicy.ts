import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface AthenaPolicyProps {
  dataBucket: s3.IBucket;
  resultsBucket: s3.IBucket;
  projectName: string;
  environment: string;
}

export class AthenaPolicy extends Construct {
  public readonly athenaServiceRole: iam.Role;
  public readonly athenaQueryExecutionPolicy: iam.PolicyDocument;

  constructor(scope: Construct, id: string, props: AthenaPolicyProps) {
    super(scope, id);

    const { dataBucket, resultsBucket, projectName, environment } = props;

    // Policy for Athena query execution
    this.athenaQueryExecutionPolicy = new iam.PolicyDocument({
      statements: [
        // S3 permissions for data access
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:ListBucket',
            's3:GetBucketLocation',
            's3:ListBucketMultipartUploads',
            's3:ListMultipartUploadParts',
            's3:AbortMultipartUpload',
            's3:GetBucketVersioning',
          ],
          resources: [
            dataBucket.bucketArn,
            `${dataBucket.bucketArn}/*`,
          ],
        }),
        // S3 permissions for query results
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
            's3:ListBucket',
            's3:GetBucketLocation',
            's3:ListBucketMultipartUploads',
            's3:ListMultipartUploadParts',
            's3:AbortMultipartUpload',
            's3:GetBucketVersioning',
          ],
          resources: [
            resultsBucket.bucketArn,
            `${resultsBucket.bucketArn}/*`,
          ],
        }),
        // Athena permissions
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'athena:BatchGetQueryExecution',
            'athena:GetQueryExecution',
            'athena:GetQueryResults',
            'athena:GetQueryResultsStream',
            'athena:StartQueryExecution',
            'athena:StopQueryExecution',
            'athena:ListQueryExecutions',
            'athena:GetWorkGroup',
            'athena:GetDataCatalog',
            'athena:GetDatabase',
            'athena:GetTableMetadata',
            'athena:ListDatabases',
            'athena:ListTableMetadata',
          ],
          resources: [
            `arn:aws:athena:*:*:workgroup/${projectName}-workgroup-${environment}`,
            `arn:aws:athena:*:*:datacatalog/*`,
          ],
        }),
        // Glue Data Catalog permissions
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
            'glue:CreateTable',
            'glue:UpdateTable',
            'glue:DeleteTable',
          ],
          resources: [
            `arn:aws:glue:*:*:catalog`,
            `arn:aws:glue:*:*:database/${projectName}_${environment}`,
            `arn:aws:glue:*:*:table/${projectName}_${environment}/*`,
          ],
        }),
        // CloudWatch Logs permissions for Athena query logging
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
            `arn:aws:logs:*:*:log-group:/aws/athena/${projectName}-${environment}*`,
          ],
        }),
      ],
    });

    // Service role for Athena workgroup
    this.athenaServiceRole = new iam.Role(this, `${projectName}AthenaServiceRole${environment}`, {
      roleName: `${projectName}-athena-service-role-${environment}`,
      assumedBy: new iam.ServicePrincipal('athena.amazonaws.com'),
      description: `Athena service role for ${projectName} - ${environment}`,
      inlinePolicies: {
        AthenaExecutionPolicy: this.athenaQueryExecutionPolicy,
      },
    });

    // Tags
    cdk.Tags.of(this.athenaServiceRole).add('Environment', environment);
    cdk.Tags.of(this.athenaServiceRole).add('Project', projectName);
    cdk.Tags.of(this.athenaServiceRole).add('Service', 'Athena');
  }

  /**
   * Create a policy for Lambda functions to execute Athena queries
   */
  public createLambdaAthenaPolicy(): iam.PolicyDocument {
    return new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'athena:StartQueryExecution',
            'athena:GetQueryExecution',
            'athena:GetQueryResults',
            'athena:StopQueryExecution',
            'athena:ListQueryExecutions',
          ],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'glue:GetDatabase',
            'glue:GetTable',
            'glue:GetPartitions',
          ],
          resources: ['*'],
        }),
      ],
    });
  }
}
