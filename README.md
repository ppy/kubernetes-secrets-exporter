# kubernetes-secrets-exporter

Micro-service to expose Kubernetes secrets to clients using client certificates over HTTPS

## Architecture

This application serves secrets to allow-listed clients, both defined in a ConfigMap manifest. It can be deployed in two listening modes:
- In HTTP mode, the back-end expects a reverse proxy in front of the application to handle HTTPS and client certificate authentication. The back-end trusts the reverse proxy to pass the client certificate subject's common name via the `ssl-client-subject-dn` header. The application must not be exposed to anything but the reverse proxy.
- In HTTPS mode, the back-end handles the TLS termination and client certificate authentication directly.

The ConfigMap manifest (name configured by the `CONFIGMAP_NAME` env var, defaults to `kubernetes-secrets-exporter`) contains a single entry: `secrets.json` which lists secrets with allow-listed clients for each.  
See the schema in [configmap.schema.json](/configmap.schema.json).

## Deployment & Usage

We only support deployment and usage of this micro-service through our Helm chart. See: https://github.com/ppy/helm-charts/tree/master/osu/kubernetes-secrets-exporter

## API

A single API call is available: `/secrets/:secretName/download/:key`.  
If authenticated and authorized, this endpoint will deliver the value of the `:key` element inside the secret named `:secretName`.
