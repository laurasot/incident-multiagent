import * as iam from "aws-cdk-lib/aws-iam";

export const createAssumeRolePolicy = (crossAccountRoleArn: string): iam.PolicyStatement => {
  return new iam.PolicyStatement({
    sid: "AssumeRoleCrossAccount",
    effect: iam.Effect.ALLOW,
    actions: ["sts:AssumeRole"],
    resources: [crossAccountRoleArn],
  });
};

export const createCrossAccountS3Policy = (bucketArn: string): iam.PolicyStatement => {
  return new iam.PolicyStatement({
    sid: "CrossAccountS3Access",
    effect: iam.Effect.ALLOW,
    actions: [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
      "s3:GetBucketLocation",
    ],
    resources: [
      bucketArn,
      `${bucketArn}/*`,
    ],
  });
};
