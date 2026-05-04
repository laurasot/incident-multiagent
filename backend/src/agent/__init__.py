import os
from bedrock_agentcore import BedrockAgentCoreApp

app = BedrockAgentCoreApp()
logger = app.logger
#logger.setLevel(os.getenv("LOG_LEVEL", "INFO"))