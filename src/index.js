const express = require('express');
const k8s = require('@kubernetes/client-node');

const app = express();
app.set('trust proxy', true);

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

app.get('/', (req, res) => 
  res.status(200).send('Hello World!'));

app.get('/secrets/:secretName/download/:key', async (req, res) => {
  const clientName = (req.headers[process.env.SSL_CLIENT_SUBJECT_HEADER ?? 'ssl-client-subject-dn'] ?? '').replace('CN=', '');
  if(!clientName) {
    console.error(`401: Client was rejected because of missing client certificate from ${req.ip}! THIS APPLICATION IS EXPOSED!`);
    return res.sendStatus(401);
  }

  try {
    const namespaceName = kc.contexts.find(ctx => ctx.name === kc.currentContext).namespace;

    const configMapName = process.env['CONFIGMAP_NAME'] ?? 'kubernetes-secrets-exporter';
    const configMap = await k8sApi.readNamespacedConfigMap(configMapName, namespaceName);
    if(!configMap)
      throw new Error(`Couldn't get configmap/${configMapName}`)

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
      throw new Error(`Couldn't get secret/${secretName}`)

    const value = secret.body.data[req.params.key];
    if(!value) {
      console.warn(`404: Key ${req.params.key} was not found in secret/${secretName}`)
      return res.status(404).send(`Key ${req.params.key} was not found in secret/${secretName}`);
    }

    console.log(`200: ${clientName} downloaded ${secretName}/${req.params.key} from ${req.ip}`);
    res.send(Buffer.from(value, 'base64').toString('utf8'));
  } catch(err) {
    console.error(`500: ${clientName} tried ${req.url} from ${req.ip}`, err);
    res.sendStatus(500);
  }
});

app.listen(5000, () => 
  console.log('kubernetes-secrets-exporter is running on port 5000'));
