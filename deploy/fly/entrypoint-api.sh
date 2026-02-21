#!/bin/sh
# Maps Fly.io secrets (which must be valid POSIX env var names) to the
# hyphenated env var names that .NET/Aspire configuration expects.
#
# Fly.io secret:  OPENAI_CONNECTION_STRING
# .NET config:    ConnectionStrings:gpt-4o-mini  →  env var ConnectionStrings__gpt-4o-mini
#
# Aspire's OpenAI client requires Deployment=<model> in the connection string.
# If the user's secret doesn't already contain it, append it automatically.

CONN="${OPENAI_CONNECTION_STRING}"
case "$CONN" in
  *[Dd]eployment=*) ;; # already has Deployment
  *) CONN="${CONN};Deployment=gpt-4o-mini" ;;
esac

exec env "ConnectionStrings__gpt-4o-mini=${CONN}" dotnet SketchAI.Api.dll
