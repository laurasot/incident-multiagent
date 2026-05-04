import * as iam from "aws-cdk-lib/aws-iam";

export const appSyncPolicy = new iam.PolicyStatement({
  actions: [
    "appsync:GraphQL",
    "appsync:GetGraphqlApi",
    "appsync:ListGraphqlApis",
    "appsync:ListApiKeys",
    "appsync:ListTypes",
    "appsync:GetType",
    "appsync:ListResolvers",
    "appsync:GetResolver",
    "appsync:ListFunctions",
    "appsync:GetFunction",
    "appsync:ListDataSources",
    "appsync:GetDataSource"
  ],
  resources: ["*"],
});

export const appSyncGraphQLPolicy = new iam.PolicyStatement({
  actions: ["appsync:GraphQL"],
  resources: ["*"],
  effect: iam.Effect.ALLOW
});
