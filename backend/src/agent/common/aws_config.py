import boto3
from .. import logger

_session = boto3.Session()
_ssm_client = boto3.client("ssm")


def get_aws_region() -> str:
    """Get AWS region from boto3 session (no env var needed)."""
    region = _session.region_name
    if not region:
        region = boto3.DEFAULT_SESSION.region_name if boto3.DEFAULT_SESSION else None
    if not region:
        raise RuntimeError("AWS region not available from boto3 session")
    return region


def get_memory_id(project_name: str, env_name: str, memory_type: str) -> str:
    """Get memory ID from SSM Parameter Store.

    Args:
        project_name: Project name (e.g. 'incident-response')
        env_name: Environment name (e.g. 'dev')
        memory_type: Memory type key (e.g. 'short-term', 'long-term-incidents', 'long-term-resolutions')

    Returns:
        Memory ID string
    """
    param_name = f"/{project_name}/{env_name}/memory/{memory_type}/id"
    response = _ssm_client.get_parameter(Name=param_name, WithDecryption=False)
    memory_id = response["Parameter"]["Value"]
    logger.info("Memory ID loaded from SSM %s → %s", param_name, memory_id)
    return memory_id
