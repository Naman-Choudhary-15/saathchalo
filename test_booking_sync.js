const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch();
        
        // Tab 1: Driver
        const driverPage = await browser.newPage();
        await driverPage.goto('http://127.0.0.1:8085/driver', {waitUntil: 'networkidle0'});
        await driverPage.type('#driverPinInput', '1234');
        await new Promise(r => setTimeout(r, 2000)); // wait for login and initial data load
        
        // Get initial demand from driver portal
        const initialDemand = await driverPage.$eval('#statLiveDemand', el => el.innerText);
        console.log('Driver initial live demand:', initialDemand);
        
        // Tab 2: Customer
        const customerPage = await browser.newPage();
        await customerPage.goto('http://127.0.0.1:8085/customer', {waitUntil: 'networkidle0'});
        
        // Click confirm booking on customer portal
        await customerPage.evaluate(() => {
            const btn = document.getElementById('confirmRideBtn');
            if (btn) btn.click();
        });
        console.log('Customer clicked confirm booking');
        
        // Wait a few seconds for SSE
        await new Promise(r => setTimeout(r, 4000));
        
        // Check Driver portal again
        const newDemand = await driverPage.$eval('#statLiveDemand', el => el.innerText);
        console.log('Driver new live demand:', newDemand);
        
        if (newDemand !== initialDemand) {
            console.log('SUCCESS: Driver portal updated live!');
        } else {
            console.log('FAIL: Driver portal demand did not update.');
            process.exit(1);
        }
        
        await browser.close();
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
