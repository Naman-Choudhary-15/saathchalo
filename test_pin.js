const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto('http://127.0.0.1:8085/driver', {waitUntil: 'networkidle0'});
        const overlayVisible = await page.evaluate(() => {
            const el = document.getElementById('driverPinOverlay');
            return window.getComputedStyle(el).display !== 'none';
        });
        console.log('Overlay initially visible:', overlayVisible);
        
        await page.type('#driverPinInput', '1234');
        
        // Wait a bit for the transition
        await new Promise(r => setTimeout(r, 1000));
        
        const overlayAfter = await page.evaluate(() => {
            const el = document.getElementById('driverPinOverlay');
            return window.getComputedStyle(el).display;
        });
        console.log('Overlay display after typing PIN:', overlayAfter);
        
        const mapLoaded = await page.evaluate(() => {
            return typeof driverMapInstance !== 'undefined' && driverMapInstance !== null;
        });
        console.log('Map initialized after login:', mapLoaded);
        
        await browser.close();
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
