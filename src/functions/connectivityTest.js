const { app, input } = require('@azure/functions');
const net = require('net');
const { ApplicationInsights } = require('@microsoft/applicationinsights-web');
const appInsights = new ApplicationInsights({
    config: {
        connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
    },
});
appInsights.loadAppInsights();
const tableName = process.env.TableStorageTableName;

const tableInput = input.table({
    tableName: tableName,
    connection: 'TableStorageConnectionString'
});

app.http('connectivityTest', {
    methods: ['GET'],
    authLevel: 'anonymous',
    extraInputs: [tableInput],
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);
        const testList = context.extraInputs.get(tableInput);
        let results = [];
        for (const test of testList) {
            try {
                const result = await testConnection(test.host, test.port, test.expectedSuccess);
                context.log(`Test: ${result.host}:${result.port} expected to succeed: ${result.expectedSuccess}; Test ${result.testSuccess ? "succeeded" : "failed"}`);
                results.push(result)
                // send the result to app insights
                appInsights.trackEvent({
                    name: "Connectivity Test Result",
                    properties: {
                        host: result.host,
                        port: result.port,
                        expectedSuccess: result.expectedSuccess,
                        testSuccess: result.testSuccess,
                        message: result.message
                    }
                });
            } catch (error) {
                context.log(error)
            }
        }
        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: "Tests Report", results: results }),
        }
    }
});


function testConnection(host, port, expectedSuccess) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        client.setTimeout(3000);

        client.connect(port, host, () => {
            resolve({ host: host, port: port, connectionSuccess: true, expectedSuccess: expectedSuccess, testSuccess: (true == expectedSuccess), message: "Connection " + host + ":" + port + " successful" });
            client.destroy();
        });

        client.on('error', (err) => {
            resolve({ host: host, port: port, connectionSuccess: false, expectedSuccess: expectedSuccess, testSuccess: (false == expectedSuccess), message: "Connection " + host + ":" + port + " not succesful " + err.message });
            client.destroy();
        });

        client.on('timeout', () => {
            resolve({ host: host, port: port, connectionSuccess: false, expectedSuccess: expectedSuccess, testSuccess: (false == expectedSuccess), message: "Connection " + host + ":" + port + " session timeout" });
            client.destroy();
        });
    });
}
