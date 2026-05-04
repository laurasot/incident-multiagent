import * as iam from "aws-cdk-lib/aws-iam";

export const transcribePolicy = new iam.PolicyStatement({
  actions: ["transcribe:*"],
  resources: ["*"],
});
