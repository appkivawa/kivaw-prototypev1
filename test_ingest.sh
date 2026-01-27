#!/bin/bash
curl -X POST https://pjuueamhdxqdrnxvavwd.supabase.co/functions/v1/ingest_rss \
  -H "x-ingest-secret: 3bded7b3c3f71f060549e6dee5668456493e2b2a93a84d54b1f4d7f62ea6eb11" \
  -H "Content-Type: application/json" \
  -d '{"maxFeeds": 5, "perFeedLimit": 50}'
