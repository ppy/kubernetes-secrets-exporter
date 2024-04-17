const express = require('express');
const k8s = require('@kubernetes/client-node');

const LISTEN_MODE = process.env['LISTEN_MODE'];
if(LISTEN_MODE !== 'http' && LISTEN_MODE !== 'https')
  throw new Error('LISTEN_MODE is invalid or undefined. Valid values: http, https');

let trustProxy = false;
// only enable if the environment variable is set to true or 1 (case-insensitive)
if(process.env["TRUST_PROXY"] !== undefined)
  trustProxy = !['false', '0'].includes(process.env['TRUST_PROXY'].toLowerCase());

const app = express();
app.set('trust proxy', trustProxy);

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

app.get('/', (req, res) =>
  res.status(200).send('Hello World!'));

app.get('/secrets/:secretName/download/:key', async (req, res) => {
  let clientName;
  try {
    if(LISTEN_MODE === 'http') {
      clientName = req.headers[process.env.SSL_CLIENT_SUBJECT_HEADER ?? 'ssl-client-subject-dn'].replace('CN=', '');
    } else {
      clientName = req.socket.getPeerCertificate().subject.CN;
    }

    const namespaceName = kc.contexts.find(ctx => ctx.name === kc.currentContext).namespace;

    const configMapName = process.env['CONFIGMAP_NAME'] ?? 'kubernetes-secrets-exporter';
    const configMap = await k8sApi.readNamespacedConfigMap(configMapName, namespaceName);
    if(!configMap)
      throw new Error(`Couldn't get configmap/${configMapName}`);

    let secrets = configMap.body.data['secrets.json'];
    if(!secrets)
      throw new Error(`configmap/${configMapName} is missing the secrets.json key`);

    try {
      secrets = JSON.parse(secrets);
    } catch(err) {
      throw new Error(`Couldn't parse configmap/${configMapName} secrets.json key from JSON: ${err.message}`);
    }
    if(typeof secrets !== 'object' || Array.isArray(secrets))
      throw new Error('Secrets definition is invalid');

    const { secretName } = req.params;
    const secretDefinition = secrets[secretName];
    if(typeof secretDefinition === 'undefined') {
      console.warn(`404: ${clientName} tried getting ${secretName}/${req.params.key} from ${req.ip}`);
      return res.status(404).send('Secret definition not found');
    }
    if(typeof secretDefinition !== 'object' || Array.isArray(secretDefinition))
      throw new Error(`Secret definition for ${secretName} is invalid`);
    if(!Array.isArray(secretDefinition.allowedSubjectNames))
      throw new Error(`allowedSubjectNames definition for ${secretName} is invalid`);

    if(!secretDefinition.allowedSubjectNames.includes(clientName)) {
      console.error(`403: ${clientName} tried getting ${secretName}/${req.params.key} from ${req.ip}`);
      return res.sendStatus(403);
    }

    const secret = await k8sApi.readNamespacedSecret(secretName, namespaceName);
    if(!secret)
      throw new Error(`Couldn't get secret/${secretName}`);

    const value = secret.body.data[req.params.key];
    if(!value) {
      console.warn(`404: Key ${req.params.key} was not found in secret/${secretName}`);
      return res.status(404).send(`Key ${req.params.key} was not found in secret/${secretName}`);
    }

    console.log(`200: ${clientName} downloaded ${secretName}/${req.params.key} from ${req.ip}`);
    res.send(Buffer.from(value, 'base64').toString('utf8'));
  } catch(err) {
    console.error(`500: ${req.ip} (CN: ${clientName}) tried ${req.url}`, err);
    res.sendStatus(500);
  }
});

let server;
if(LISTEN_MODE === 'http') {
  const http = require('http');

  server = http.createServer(app);
} else {
  const https = require('https');
  const fs = require('fs');

  const caPath = process.env['CA_CERT_PATH'] ?? '/ca-certs/ca.crt';
  const certPath = process.env['TLS_CERT_PATH'] ?? '/tls-certs/tls.crt';
  const keyPath = process.env['TLS_KEY_PATH'] ?? '/tls-certs/tls.key';

  function getSecurityContext() {
    const ca = fs.readFileSync(caPath);
    const cert = fs.readFileSync(certPath);
    const key = fs.readFileSync(keyPath);

    return { cert, key, ca };
  }

  server = https.createServer({
      ...getSecurityContext(),
      requestCert: true,
      rejectUnauthorized: true,
  }, app);

  for(const path of [caPath, certPath, keyPath]) {
    fs.watch(path, (event) => {
      try {
        console.log(`Detected ${event} on ${path}`);
        server.setSecureContext(getSecurityContext());
        console.log('Successfully reloaded certificates');
      } catch(err) {
        console.error('Error while reloading certificates', err);
      }
    });
  }
}

const port = process.env.PORT || 5000;
server.listen(port, () =>
  console.log(`kubernetes-secrets-exporter is running on port ${port}`));
