# loopback-connector-google-cloud-datastore

Google Cloud Datastore connector for the LoopBack framework.

[![Build Status](https://dev.azure.com/henriquecarvgit/henriquecarvgit/_apis/build/status/henriquecarv.loopback-connector-google-cloud-datastore?branchName=master)](https://dev.azure.com/henriquecarvgit/henriquecarvgit/_build/latest?definitionId=5)
[![npm](https://img.shields.io/npm/dt/loopback-connector-google-cloud-datastore.svg)](https://www.npmjs.com/package/loopback-connector-google-cloud-datastore)
[![npm](https://img.shields.io/npm/v/loopback-connector-google-cloud-datastore.svg)](https://www.npmjs.com/package/loopback-connector-google-cloud-datastore)
[![LICENSE](https://img.shields.io/github/license/henriquecarv/loopback-connector-google-cloud-datastore.svg)](./LICENSE)
[![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=henriquecarv/loopback-connector-google-cloud-datastore)](https://dependabot.com)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fhenriquecarv%2Floopback-connector-google-cloud-datastore.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fhenriquecarv%2Floopback-connector-google-cloud-datastore?ref=badge_shield)

## System Requirements

- **[NodeJS](https://nodejs.org/en/)** (version >= 10).

## Installation

If you want to know how to get started with Loopback [check this][5].

To add a new data source, use the data source generator:

```sh
lb datasource
```

Then the data source generator will prompt some questions like

- Enter the data-source name: **GoogleCloudDatastore** _(Choose your prefered name)_
- Select the connector for GoogleCloudDatastore: **other**
- Enter the connector's module name **loopback-connector-google-cloud-datastore**
- Install loopback-connector-google-cloud-datastore (Y/n) **y**

Then you should use a service account. Go to [Project Settings > Service Accounts][4] in the Google Cloud Platform Console. Generate a new private key and save the JSON file.

You should fill the application's datasource file which is located in `/server/datasources.json` with those details, You can find them in the downloaded JSON file from the Google Cloud Platform.

```json
"GoogleCloudDatastore": {
  "name": "GoogleCloudDatastore",
  "projectId": "",
  "keyFilename": "" //Enter the full relative path of your application to file (eg. './src/datasources/google/serviceAccount.json')
}
```

### Connection properties

| Property    | Type&nbsp;&nbsp; | Description                   | --- |
| ----------- | ---------------- | ----------------------------- | --- |
| projectId   | String           | project_id in the JSON file   | --- |
| keyFilename | String           | serviceAccount JSON file path | --- |

And you can actually store those private details as an Environment variables, Check [source-configuration][6]

### Inspiration

[Dyaa Eldin Moustafa][7] [Firestore connector][3]

### License

Copylefted (c) 2018 [Henrique Carvalho da Cruz][1] Licensed under the [MIT license][2].

[1]: https://henriquecarv.com
[2]: ./LICENSE
[3]: https://github.com/dyaa/loopback-connector-firestore
[4]: https://console.cloud.google.com/projectselector/iam-admin/serviceaccounts
[5]: http://loopback.io/getting-started/
[6]: https://loopback.io/doc/en/lb3/Environment-specific-configuration.html#data-source-configuration
[7]: https://github.com/dyaa

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fhenriquecarv%2Floopback-connector-google-cloud-datastore.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fhenriquecarv%2Floopback-connector-google-cloud-datastore?ref=badge_large)
