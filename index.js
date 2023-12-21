const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const path = require("path")
let tokens;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let win;
const createWindow = async () => {

    // Show mini popup
    const miniloader = new BrowserWindow({
        title: "Bus App - Loading...",
        maximizable: false,
        show: false,
        width: 400,
        height: 160,
        frame: false,
        icon: "./public/images/busIcon.png"
    })

    await miniloader.loadFile('./public/loader.html')
    miniloader.show()
    // If no internet connection, abort app load (because we need it).
    try {
        await fetch("https://arrivabus.co.uk/api")
    }
    catch (errorror) {
        await dialog.showMessageBox(miniloader, {
            title: "Couldn't connect to Arriva",
            message: "This Bus App could not connect to the Arriva servers. \nDouble check your internet connection, internet access and firewall before trying again!",
            icon: "./public/images/busIcon.png"
        })

        process.exit(0)

    }
    await sleep(1000)
    win = new BrowserWindow({
        title: "Bus App",
        maximizable: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        },
        show: false,
        icon: "./public/images/busIcon.png"
    })
    const template = [
        {
            label: 'Settings', 
            role: "services", 
            submenu: [
                {
                    label: "Places",
                    submenu: [
                        { label: "Edit Startup Location", click: () => ipcMain.emit("centralEvent", "editStartup") },
                        { label: "Edit Home Location", click: () => ipcMain.emit("centralEvent", "editHome") },
                        { label: "Edit Work Location", click: () => ipcMain.emit("centralEvent", "editWork") }
                    ]
                },
            ]
        },
        {
            label: 'Help', 
            role: "help",
            submenu: [
                { label: "Website", },
                { label: "Report a bug/issue", click: () => ipcMain.emit("centralEvent", "editStartup") },
                { label: "Developer Mode", submenu: [
                    { label: "Open DevTools Window", click: () => win.webContents.openDevTools()},
                    { label: "Relaunch from Console", click: () => {}},
                ]},
                { label: "Relaunch", click: () => {
                    app.relaunch();
                    app.exit();
                }},
                { label: "Quit Bus App", click: () => {
                    app.quit();
                }}
            ],
        }
    ]
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))

    win.maximize();

    // Get access and refresh tokens.
    let tokenresponse = await getJSON({ url: "https://api.arrivabus.co.uk/accounts/register-device", method: "POST", body: { clientType: "web" } });
    /**
     * Contains tokens for the arriva site. Updated every 10 mins
     */
    tokens = {
        /**
         * Access Token
         */
        access: tokenresponse.accessToken,
        /**
         * Refresh Token (shouldn't be needed externally as it will refresh itself).
         */
        refresh: tokenresponse.refreshToken
    };

    // In 10 mins, refresh those.
    setInterval(async () => {
        let newtokenresponse = await getJSON({ url: "https://api.arrivabus.co.uk/accounts/refresh-token", method: "PUT", body: { token: tokens.refresh } });
        tokens = {
            access: newtokenresponse.accessToken,
            refresh: newtokenresponse.refreshToken
        };
    }, 600000)
    await win.loadFile('./public/index.html')
    win.show()
    miniloader.close()
}

/**
 * The args to put in for the getJSON() function
 * @typedef {Object} getJSONURLObj
 * @property {('GET'|'PUT'|'POST'|'OPTIONS')} method - The method to send the request as.
 * @property {Object} body - The body to send. Only available with PUT and POST
 * @property {String} auth - Auth token to send
 * @property {String} url - The URL to send the request to.
 */

/**
 * Gets a JSON Object from a URL.
 * @param {getJSONURLObj} args Object containing things to request
 */
async function getJSON(args) {
    if (!args.method) args.method = "GET";
    if (!args.url) throw new Error("No URL provided");

    let headers = {}
    headers["Content-Type"] = "application/json";
    if (args.auth) headers["Authorization"] = args.auth;

    try {
        let r = await fetch(args.url, {
            method: args.method,
            body: JSON.stringify(args.body),
            headers: headers
        })
        console.log("Request successfully made to " + args.url)
        let t = await r.text()
        return JSON.parse(t)
    }
    catch (err) {
        let errres = await dialog.showMessageBox(win, {
            title: "Couldn't connect to Arriva",
            message: "This Bus App could not connect to the Arriva servers. \nTry relaunching to fix this issue.",
            icon: "./public/images/busIcon.png",
            buttons: [
                "Relaunch", "Quit"
            ]
        })
        if (errres.response == 0) {
            app.relaunch()
            app.exit()
        }
    }
}

app.whenReady().then(async () => {
    createWindow()

    // Handle getAlerts
    ipcMain.handle('busAPI:getAlerts', async (e) => {
        return await getJSON({ url: "https://api.arrivabus.co.uk/alerts?channel=web,mweb&type=global", auth: "Bearer " + tokens.access })
    })

    // and stops
    ipcMain.handle('busAPI:getStops', async (e, lat, lng) => {
        return await getJSON({ url: "https://api.arrivabus.co.uk/stops?lat=" + lat + "&lon=" + lng, auth: "Bearer " + tokens.access })
    })

    // and stationboards
    ipcMain.handle('busAPI:getStationboard', async (e, stopID) => {
        return await getJSON({ url: "https://api.arrivabus.co.uk/stationboards/" + stopID, auth: "Bearer " + tokens.access })
    })

    // and nearby services (on the map)
    ipcMain.handle('busAPI:getServices', async (e, lat, lng) => {
        return await getJSON({ url: "https://api.arrivabus.co.uk/services?lat=" + lat + "&lon=" + lng, auth: "Bearer " + tokens.access })
    })

    // and individual services
    ipcMain.handle('busAPI:getService', async (e, busID) => {
        return await getJSON({ url: "https://api.arrivabus.co.uk/services/" + busID + "?includePolyline=true", auth: "Bearer " + tokens.access })
    })

    // and app relaunches
    ipcMain.handle('app:relaunch', async (e) => {
        app.relaunch();
        app.exit();
    })

})

/**
 * API Docs
 * Base URL api.arrivabus.co.uk
 * 
 * [POST] /accounts/register-device
 * Fetches the access and refresh tokens.
 * Body (json): {clientType:"web"}
 * 
 * [GET] /alerts?channel=web,mweb&type=global
 * Fetches the alerts
 * Authorization: Bearer <Access Token>
 * 
 * [GET] /stops?lat=<latitude coordinates>&lon=<longitude coordinates>
 * Fetches the stops, including the ID for the stationboard
 * Authorization: Bearer <Access Token>
 * 
 * [GET] /stationboards/<Stop ID>
 * Fetches the next buses arriving at the stop
 * Authorization: Bearer <Access Token>
 * 
 * [GET] /services?lat=<Latitude>&lon=<longitude>
 * Gets the buses in the area.
 * Authorization: Bearer <Access Token>
 * 
 * [GET] /services/<Bus ID>
 * Gets the info on the bus provided.
 * Authorization: Bearer <Access Token>
 * 
 * [PUT] /accounts/refresh-token
 * Get the new tokens to continue browsing. **This should be called after 10 minutes**
 * Body: {token: <Refresh Token>}
 * Authorization: <Access Token>
 * 
 */