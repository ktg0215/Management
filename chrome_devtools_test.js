const CDP = require('chrome-remote-interface');

async function testApplication() {
    let client;
    try {
        // Connect to Chrome
        client = await CDP();
        const {Page, Runtime, Network, Console} = client;

        // Enable necessary domains
        await Promise.all([
            Page.enable(),
            Runtime.enable(),
            Network.enable(),
            Console.enable()
        ]);

        console.log('Connected to Chrome DevTools');
        
        // Navigate to login page
        console.log('\n=== Testing Login Page ===');
        await Page.navigate({url: 'http://localhost:3002/login'});
        await Page.loadEventFired();
        
        // Wait a bit for the page to fully load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('Login page loaded successfully');
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

testApplication();
