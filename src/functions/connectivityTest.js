const { app, input } = require('@azure/functions');
const net = require('net');

const tableInput = input.table({
    tableName: 'test',
    connection: 'AzureWebJobsStorage'
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
            } catch (error) {
                context.log(error)
            }
        }
        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: "Tests run successfully", results: results }),
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
