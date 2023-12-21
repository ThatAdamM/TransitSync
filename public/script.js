var map = L.map('map').setView([54.97328, -1.61396], 13);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

let busstop = L.icon({
    iconUrl: "./images/BusStop.png",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
})

let buses = L.layerGroup([

]).addTo(map);

let stops = L.layerGroup([

]).addTo(map);

let places = L.layerGroup([

]).addTo(map);

let polyline = L.layerGroup([]).addTo(map);
let polyline2 = L.layerGroup([]).addTo(map);

var layerControl = L.control.layers(null, { "Buses": buses, "Stops": stops, "Your Places": places }).addTo(map);

// Once the map is done moving, get the new data.
async function updateBuses(dathing) {
    let currentpan = map.getCenter();
    let buslocations;
    try {
        buslocations = await window.busAPI.getServices(currentpan.lat, currentpan.lng)
    }
    catch (err) {
        document.getElementById("toasty").show()
    }
    lastcenter = currentpan;

    buses.clearLayers();
    buslocations.forEach((elemento) => {
        // For each bus
        let status;
        let colour;
        // Get if Late/Early/On Time/The dreaded "CANCELLED"
        if (elemento.service.cancelled == true) {
            status = "❌ CANCELLED"
            colour = "red";
        } else {
            let lastCall = elemento.callingPoints.at(-1)
            let rdt = new Date(lastCall.realArrivalTime)
            let sdt = new Date(lastCall.scheduledArrivalTime)
            if (rdt > sdt) {
                status = `⚠️ Delayed (+${Math.floor((rdt - sdt) / 60000)})`
                colour = "orange";
            } else if (rdt < sdt) {
                status = `⚠️ Early (+${Math.floor((sdt - rdt) / 60000)})`
                colour = "orange";
            } else if (Math.floor(rdt - sdt) == 0) {
                status = "✅ On Time"
                colour = "green";
            } else {
                status = "Unknown"
            }
        }
        // Get each's icon and popup
        let iconny = L.divIcon({
            html: `<img src="./images/busIcon.png" class="busIconImage" width="32" height="32"><span class="busIconLabel">${elemento.service.line.name}</span><img src="./images/ArrowHead.png" width="52" height="52" class="busIconArrowHead" style="transform: rotate(${elemento.service.position.direction * 36}deg);">`,
            className: "busIcon"
        });
        let popupy = L.popup()
            .setLatLng(elemento.service.position.lat, elemento.service.position.long)
            .setContent(`<div class="popupBox"><p style="width:100%;"><strong class="lineNo">${elemento.service.line.name}</strong> <strong style="float:right; color: ${colour}">${status}</strong><br>To:<br><strong>${elemento.service.lastStop}</strong><br><a style="float:right;" onclick="showServiceDetail('${elemento.service.id}')" >More Info</a></p></div>`)

        // The marker for a bus:
        let marc = L.marker([elemento.service.position.lat, elemento.service.position.long], { icon: iconny }).bindPopup(popupy)
        // Apply the polyline for it
        marc.getPopup().on('add', async function () {
            // Add polyline when popup is added
            let busdata = await window.busAPI.getService(elemento.service.id);
            console.log(busdata)

            polyline.addLayer(L.polyline(busdata.polyline, { color: 'black' }))
        });
        marc.getPopup().on('remove', function () {
            // And take it away when it's gone
            polyline.clearLayers()
        });
        buses.addLayer(marc)
    })
}

async function updateStops() {
    stops.clearLayers()
    let currentpan = map.getCenter();
    let stopsres = await window.busAPI.getStops(currentpan.lat, currentpan.lng);
    stopsres.forEach((el) => {
        let stopmarkererer = L.marker([el.stop.position.lat, el.stop.position.long], {
            icon: busstop
        })

        stopmarkererer.addEventListener("click", async () => {
            let stationboard = await window.busAPI.getStationboard(el.stop.id);
            let departures = "";
            stationboard.departures.slice(0, 5).forEach((elem) => {
                let timetogo;
                let estimatedtime = new Date(elem.scheduledDepartureTime).getHours() + ":" + new Date(elem.scheduledDepartureTime).getMinutes();
                let delays = false;
                if (elem.disruption.cancelled) {
                    timetogo = "CANCELLED"
                    delays = "❌"
                } else if (!elem.departureTime) {
                    let remainingtime = new Date(elem.scheduledDepartureTime).getTime() - Date.now();
                    timetogo = Math.floor(remainingtime / 60000) + " Minute(s)"
                    delays = "✅"
                } else {
                    let remainingtime = new Date(elem.departureTime).getTime() - Date.now();
                    timetogo = Math.floor(remainingtime / 60000) + " Minute(s)"
                    let newtime = Math.floor(new Date(elem.departureTime) - new Date(elem.scheduledDepartureTime));
                    delays = newtime == 0 ? "✅" : ("⚠️ (" + (newtime < 0 ? "" : "+") + newtime / 60000 + ")");

                }
                departures += `<strong class="lineNo">${elem.line.name}</strong> ${elem.service.direction} - ${timetogo} - ${estimatedtime} ${delays == false ? "" : delays}<br>`
            })
            L.popup().setLatLng({ lat: el.stop.position.lat, lng: el.stop.position.long }).setContent(`<p><strong>${el.stop.name}</strong><br>Live Departures:<br>${departures}<br><a onclick="openDepartureList('${el.stop.id}', '${el.stop.name}')">More departures...</a></p>`).openOn(map)
        })



        stops.addLayer(stopmarkererer)
    })
}

map.addEventListener("moveend", updateBuses)
updateBuses()
map.addEventListener("moveend", updateStops)
updateStops()

let refresh;

function negToPos(num) {
    if (num >= 0) {
        return num;
    } else {
        return Math.abs(num)
    }
}

let amrker;

async function showServiceDetail(busTrip) {
    if (amrker) map.removeLayer(amrker)
    let busservice = await window.busAPI.getService(busTrip)
    polyline2.clearLayers()
    polyline2.addLayer(L.polyline(busservice.polyline, { color: 'black' }))

    let iconny = L.divIcon({
        html: `<img src="./images/busIcon.png" class="busIconImage" width="32" height="32"><span class="busIconLabel">${busservice.service.line.name}</span><img src="./images/ArrowHead.png" width="52" height="52" class="busIconArrowHead" style="transform: rotate(${busservice.service.position?.direction ?? 0 * 36}deg);">`,
        className: "busIcon"
    });

    console.log(busservice)
    // The marker for a bus:
    if(busservice.service.position.lat && busservice.service.position.long) {
        amrker = L.marker([busservice.service.position.lat, busservice.service.position.long], { icon: iconny }).addTo(map)
    }
    document.querySelector("#stopsServiceName").innerHTML = busservice.service.line.name
    document.querySelector("#lastStopName").innerHTML = busservice.service.lastStop
    document.querySelector("#stopsList").innerHTML = ``;
    
    busservice.callingPoints.forEach((elemental) => {
        if (elemental.realDepartureTime) {
            let delay = Math.floor(new Date(elemental.realDepartureTime) - new Date(elemental.scheduledDepartureTime));
            if (delay == 0) {
                document.querySelector("#stopsList").innerHTML += `<li class="parada"><span class="nombre_parada">${elemental.name}</span>
                    <p><span class="simbolo_linea" style="background-color: green;">${Math.floor((new Date(elemental.realDepartureTime) - new Date()) / 60000) > 0 ? "In" : ""} ${negToPos(Math.floor((new Date(elemental.realDepartureTime) - new Date()) / 60000))} Mins ${Math.floor((new Date(elemental.realDepartureTime) - new Date()) / 60000) < 0 ? "ago" : ""}</span> (${new Date(elemental.scheduledDepartureTime).toLocaleTimeString({ hour: "numeric", minute: "numeric" })})</p>
                </li>`
            } else {
                document.querySelector("#stopsList").innerHTML += `<li class="parada"><span class="nombre_parada">${elemental.name}</span>
                    <p><span class="simbolo_linea" style="background-color: orange;">${Math.floor((new Date(elemental.realDepartureTime) - new Date()) / 60000) > 0 ? "In" : ""} ${negToPos(Math.floor((new Date(elemental.realDepartureTime) - new Date()) / 60000))} Mins ${Math.floor((new Date(elemental.realDepartureTime) - new Date()) / 60000) < 0 ? "ago" : ""}</span> (${new Date(elemental.scheduledDepartureTime).toLocaleTimeString({ hour: "numeric", minute: "numeric" })} +${Math.floor(delay / 60000)})</p>
                </li>`
            }
        } else {
            document.querySelector("#stopsList").innerHTML += `<li class="parada"><span class="nombre_parada">${elemental.name}</span>
                    <p><span class="simbolo_linea" style="background-color: green;">${new Date(elemental.scheduledDepartureTime).toLocaleTimeString({ hour: "numeric", minute: "numeric" })}</span> (Scheduled)</p>
                </li>`
        }
        if(elemental.id == busservice.service.routeProgress.fromCallingPointId) {
            document.querySelector("#stopsList").innerHTML += `<div class="busIcon busMovingIcon"><img src="./images/busIcon.png" class="busIconImageTwo" width="32" height="32"><span class="busIconLabelTwo">${busservice.service.line.name}</span></div>`;
        }
    })

    console.log(busservice)

    document.querySelector("#stops").style.display = "block";

}

async function closeStopsList() {
    if (amrker) map.removeLayer(amrker)
    polyline2.clearLayers()
    document.querySelector("#stopsList").innerHTML = "";
    document.querySelector("#stops").style.display = "none";
}

async function openDepartureList(stopID, stopName) {
    document.getElementById("departuresList").innerHTML = ""
    document.getElementById("stationName").innerHTML = stopName
    let stationboardo = await window.busAPI.getStationboard(stopID);
    stationboardo.departures.slice(0, 100).forEach((elementino) => {
        console.log("New elementino")
        if (elementino.disruption.cancelled == true) {
            return document.getElementById("departuresList").innerHTML += `
            <div class="departureItem">
                <span class="lineNo w-100 text-center departuresServiceName">${elementino.line.name}</span> ${elementino.service.direction}
                <span class="operator"><small>Operated By:</small><br><span style="color: ${elementino.operator.color}"><strong>${elementino.operator.id}</strong></span></span><br><br><small>Service has been:</small><br><strong style="color: red;" >Cancelled</strong><br><small>Scheduled: ${new Date(elementino.scheduledDepartureTime).toLocaleTimeString("en-GB", { hour: "numeric", minute: "numeric" })} <span style="color: red;">(Service has been cancelled.)</span></small>
            </div>`
        } else if (elementino.departureTime) {
            let delay = Math.floor((new Date(elementino.departureTime) - new Date(elementino.scheduledDepartureTime)) / 60000);
            if (delay == 0) {
                console.log(new Date(elementino.departureTime))
                document.getElementById("departuresList").innerHTML += `
                
            <a onclick="showServiceDetail('${elementino.service.id}')">
                <div class="departureItem">
                    <span class="lineNo w-100 text-center departuresServiceName">${elementino.line.name}</span> ${elementino.service.direction}
                    <span class="operator"><small>Operated By:</small><br><span style="color: ${elementino.operator.color}"><strong>${elementino.operator.id}</strong></span></span><br><br><small>Due in:</small><br><strong>${Math.floor((new Date(elementino.departureTime) - new Date()) / 60000)}</strong> Mins<br><small>Scheduled: ${new Date(elementino.scheduledDepartureTime).toLocaleTimeString("en-GB", { hour: "numeric", minute: "numeric" })} <span style="color: green;">(On Time)</span></small>
                </div>
                </a>`
            } else if (delay > 0) {
                document.getElementById("departuresList").innerHTML += `
                
            <a onclick="showServiceDetail('${elementino.service.id}')">
                <div class="departureItem">
                    <span class="lineNo w-100 text-center departuresServiceName">${elementino.line.name}</span> ${elementino.service.direction}
                    <span class="operator"><small>Operated By:</small><br><span style="color: ${elementino.operator.color}"><strong>${elementino.operator.id}</strong></span></span><br><br><small>Due in:</small><br><strong>${Math.floor((new Date(elementino.departureTime) - new Date()) / 60000)}</strong> Mins<br><small>Scheduled: ${new Date(elementino.scheduledDepartureTime).toLocaleTimeString("en-GB", { hour: "numeric", minute: "numeric" })} <span style="color: orange;">(Delayed by ${delay} mins)</span></small>
                </div>
                </a>`
            } else if (delay < 0) {
                document.getElementById("departuresList").innerHTML += `
                
            <a onclick="showServiceDetail('${elementino.service.id}')">
                <div class="departureItem">
                    <span class="lineNo w-100 text-center departuresServiceName">${elementino.line.name}</span> ${elementino.service.direction}
                    <span class="operator"><small>Operated By:</small><br><span style="color: ${elementino.operator.color}"><strong>${elementino.operator.id}</strong></span></span><br><br><small>Due in:</small><br><strong>${Math.floor((new Date(elementino.departureTime) - new Date()) / 60000)}</strong> Mins<br><small>Scheduled: ${new Date(elementino.scheduledDepartureTime).toLocaleTimeString("en-GB", { hour: "numeric", minute: "numeric" })} <span style="color: orange;">(Early by ${Math.abs(delay)} mins)</span></small>
                </div>
                </a>`
            }

        } else {
            document.getElementById("departuresList").innerHTML += `
            
            <a onclick="showServiceDetail('${elementino.service.id}')">
                <div class="departureItem">
                    <span class="lineNo w-100 text-center departuresServiceName">${elementino.line.name}</span> ${elementino.service.direction}
                    <span class="operator"><small>Operated By:</small><br><span style="color: ${elementino.operator.color}">${elementino.operator.id}</span></span><br><br><small>Scheduled For:</small><br><strong>${new Date(elementino.scheduledDepartureTime).toLocaleTimeString("en-GB", { hour: "numeric", minute: "numeric" })}</strong><br><small>${new Date(elementino.scheduledDepartureTime).toLocaleDateString("en-GB", { dateStyle: "short" })} <span style="color: green;">(No reported delays or cancellations)</span></small>
                </div>
                </a>`
        }
    })

    console.log(stationboardo)
    document.getElementById("departures").style.display = "initial";
}

async function closeDepatureList() {
    document.getElementById("departures").style.display = "none";
}

window.busAPI.centralEvent((event, data) => {
    if(event == "addPlace") {
        map.style.border = "2px solid red;"
    }
})
map.addEventListener("click", () => console.log("Clickety click!"))