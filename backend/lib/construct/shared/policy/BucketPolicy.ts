import * as iam from "aws-cdk-lib/aws-iam";

export const bucketPolicy = new iam.PolicyStatement({
  actions: ["s3:*"],
  resources: ["*"],
});
