from ragkit.connectors.base import BaseConnector, ConnectorDocument, ConnectorValidationResult, ConnectorChangeDetection
from ragkit.connectors.registry import register_connector, create_connector, available_source_types

# Import all connectors to trigger registration
import ragkit.connectors.local_directory
try:  # optional extras
    import ragkit.connectors.web_url
except Exception:
    pass
try:  # optional extras
    import ragkit.connectors.rss_feed
except Exception:
    pass
try:  # optional extras
    import ragkit.connectors.google_drive
except Exception:
    pass
try:  # optional extras
    import ragkit.connectors.onedrive
except Exception:
    pass
try:  # optional extras
    import ragkit.connectors.dropbox
except Exception:
    pass
try:  # optional extras
    import ragkit.connectors.confluence
except Exception:
    pass
try:  # optional extras
    import ragkit.connectors.notion
except Exception:
    pass
try:  # optional extras
    import ragkit.connectors.sql_database
except Exception:
    pass
try:  # optional extras
    import ragkit.connectors.rest_api
except Exception:
    pass
try:  # optional extras
    import ragkit.connectors.s3_bucket
except Exception:
    pass
try:  # optional extras
    import ragkit.connectors.email_imap
except Exception:
    pass
try:  # optional extras
    import ragkit.connectors.git_repo
except Exception:
    pass
