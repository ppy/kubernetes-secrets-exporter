# kubernetes-secrets-exporter

Micro-service to expose Kubernetes secrets to clients using client certificates over HTTPS

## Deployment & Usage

We only support deployment and usage of this micro-service through our Helm chart. See: https://github.com/ppy/helm-charts/tree/master/osu/kubernetes-secrets-exporter

## Architecture

This back-end only handles authorizing and serving the configured secrets through a ConfigMap manifest.

This app leaves *all* authentication to the ingress-nginx instance placed in front and trusts all incoming traffic. Identity is passed through the header configured by the SSL_CLIENT_SUBJECT_HEADER env var (defaults to `ssl-client-subject-dn` as is ingress-nginx's default).

The ConfigMap manifest (name configured by the `CONFIGMAP_NAME` env var, defaults to `kubernetes-secrets-exporter`) contains a single entry: `secrets.json` which is the secrets definition.  
See the schema in [configmap.schema.json](/configmap.schema.json).

## API

A single API call is available: `/secrets/:secretName/download/:key`.  
If authenticated and authorized, this endpoint will deliver the value of the `:key` element inside the secret named `:secretName`.
