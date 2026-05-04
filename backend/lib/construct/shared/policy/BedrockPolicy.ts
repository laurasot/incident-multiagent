import * as iam from "aws-cdk-lib/aws-iam";

export const bedrockPolicy = new iam.PolicyStatement({
  actions: ["bedrock:*"],
  resources: ["*"],
});
