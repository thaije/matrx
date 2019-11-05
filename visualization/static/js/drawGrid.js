/**
 * This is a file which draws the grid with all objects, used for all views:
 * Agent, human-agent and god view.
 */

var canvas = null;
var ctx = null;
var disconnected = false;
// width and height of 1 cell = square
var px_per_cell = 40;
// number of cells in width and height of map
var mapW = 10,
    mapH = 10;
var currentSecondFrames = 0,
    fpsCount = 60, // placeholder
    framesLastSecond = 60; //placeholder
var lastTickSecond = 0;
var firstDraw = true;
var parsedGifs = [];

// Colour of the default BG tile
var bgTileColour = "#C2C2C2";
var bgImage = null;
var highestTickSoFar = 0;

var prevAnimatedObjects = {};
var animatedObjects = {};
// how long should the animation of the movement be, in percentage with respect to
// the maximum number of time available between ticks 1 = max duration between ticks, 0.001 min (no animation)
var animationDurationPerc = 1;


window.onload = function() {
    canvas = document.getElementById('grid');
    ctx = canvas.getContext("2d");

    ctx.font = "bold 10pt sans-serif";
};

/**
 * Changes the size of the canvas on a window resize such that it is always fullscreen
 */
window.addEventListener("resize", fixCanvasSize);

function fixCanvasSize() {

    // get canvas element from html
    canvas = document.getElementById('grid');

    // resize to current window size
    canvas.width = document.body.clientWidth; //document.width is obsolete
    canvas.height = document.body.clientHeight; //document.height is obsolete

    // change the tiles such that the complete grid fits on the screen
    fixTileSize(canvas.width, canvas.height);

    console.log("Fixed canvas size");
}

/**
 * change the tile size such that it optimally fits on the screen
 */
function fixTileSize(canvasW, canvasH) {

    // calc the pixel per cell ratio in the x and y direcetion
    var px_per_cell_x = Math.round(canvasW / mapW);
    var px_per_cell_y = Math.round(canvasH / mapH);

    // Use the smallest one as the width AND height of the cells to keep tiles square
    px_per_cell = Math.min(px_per_cell_x, px_per_cell_y);
}

/**
 * Keep track of how many ticks per second are received
 */
function calcFps() {
    var sec = Math.floor(Date.now() / 1000);
    if (sec != currentSecondFrames) {
        currentSecondFrames = sec;
        framesLastSecond = fpsCount;
        fpsCount = 1;
    } else {
        fpsCount++;
    }
}

/**
 * check if the grid size has changed and recalculate the tile sizes if so
 */
function updateGridSize(grid_size) {
    if (grid_size[0] != mapW || grid_size[1] != mapH) {

        // save the new grid size
        mapW = grid_size[0];
        mapH = grid_size[1];

        // recalculate the sizes of the tiles
        fixTileSize(canvas.width, canvas.height);
    }
}

/*
 * Used to parse Gifs(in case they exist) into the frames they are made out of on the first load of the screen.
 */
function parseGifs(state) {
    var vis_depths = Object.keys(state);
    vis_depths.forEach(function(vis_depth) {

        // Loop through the objects at this depth and visualize them
        var objects = Object.keys(state[vis_depth]);
        objects.forEach(function(objID) {

            // fetch object
            obj = state[vis_depth][objID]
            if (obj['visualization']['shape'] == 'img') {
                if (/^.+\.gif$/.test(obj['img_name'])) {
                    var img = new Image();
                    img.src = window.location.origin + '/static/avatars/' + obj['img_name'];
                    if (!parsedGifs.hasOwnProperty(img.src)) {
                        parsedGifs[img.src] = []
                        var gif = new SuperGif({
                            gif: img
                        });
                        gif.load(function() {
                            for (var i = 0; i < gif.get_length(); i++) {
                                gif.move_to(i);
                                parsedGifs[img.src][i] = gif.get_canvas();
                            }
                            parsedGifs[img.src]["currFrame"] = 0;

                        });
                    }
                }
            }
        })
    })
}



/**
 * Converts a list of [x,y] cell coordinates to [x,y] pixel values
 */
function cellsToPxs(coords) {
    return [coords[0] * px_per_cell, coords[1] * px_per_cell]
}

/**
 * Animate the movement from one cell to the target cell for an object, by covering
 * the distance in smaller steps
 */
function processMovement(key, targetLocation, animatedObjects, timePerMove) {
    // add the object if this is our first iteration animating its movement
    if (!(key in prevAnimatedObjects)) {
        animatedObjects[key] = {
            "loc_from": targetLocation,
            "loc_to": targetLocation,
            "position": cellsToPxs(targetLocation),
            "timeStarted": Date.now()
        };
        // console.log("New agent, adding to array, new array", animatedObjects);
        return animatedObjects[key]["position"];
    }

    var obj = animatedObjects[key];
    // console.log("Fetched agent from array:", obj);

    // check if we have completed animating the movement
    if ((Date.now() - obj["timeStarted"] >= timePerMove)) {
        animatedObjects[key]["position"] = cellsToPxs(animatedObjects[key]["loc_to"]);

        // otherwise, we move the object a little to the target location
    } else {
        // calc and set the new coordinates for the object
        animatedObjects[key]["position"][0] = calcNewAnimatedCoord(animatedObjects[key], 0, timePerMove);
        animatedObjects[key]["position"][1] = calcNewAnimatedCoord(animatedObjects[key], 1, timePerMove);
    }
    return animatedObjects[key]["position"]
}


/**
 * Calculate a new coordinate of the agent as it moves in small steps
 * to the goal cell.
 * @oaram obj = object for which to calculate the animated movement
 * @param coord = which coordinate we are calculating (x or y).
 * @param timePerMove = milliseconds available for the animated motion from loc_from to loc_to
 */
function calcNewAnimatedCoord(obj, coord, timePerMove) {
    if (obj["loc_to"][coord] != obj["loc_from"][coord]) {
        // calc how many blocks our target is
        var numberOfCellsToMove = Math.abs(obj["loc_to"][coord] - obj["loc_from"][coord]);
        // how many px per ms we should traverse to get to our destination
        var pxPerMs = (numberOfCellsToMove * px_per_cell) / timePerMove;
        // how long have we been moving towards our target
        var msUnderway = Date.now() - obj["timeStarted"];
        // calc our new position
        var diff = msUnderway * pxPerMs;
        // make sure movement is in the correct direction
        diff = (obj["loc_to"][coord] < obj["loc_from"][coord] ? -diff : diff);
        // move in the correct direction from the old position
        obj["position"][coord] = (obj["loc_from"][coord] * px_per_cell) + diff

        // console.log("New animated coord:", numberOfCellsToMove, pxPerMs, msUnderway, diff);
    }
    return obj["position"][coord]
}



/**
 * Draw a background with the default colour
 */
function drawBg() {
    // clear the rectangle
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // full size rect
    if (bgImage != null) {
        var img = new Image();
        img.src = window.location.origin + '/static/backgrounds/' + bgImage;
        ctx.drawImage(img, 0, 0, mapW * px_per_cell, mapH * px_per_cell); // DRAW THE IMAGE TO THE CANVAS.
    } else {
        ctx.fillStyle = bgTileColour;
        ctx.fillRect(0, 0, mapW * px_per_cell, mapH * px_per_cell);
    }
}

/**
 * Draw a rectangle on screen
 *
 * @param {int} x: x location of tile (top left)
 * @param {int} y: y location of tile (top left)
 * @param {int} tileW: width of normal tile
 * @param {int} tileH: height of normal tile
 * @param {str} clr: colour to be used to fill the figure
 * @param {float} size: size ratio (0-1) of this tile compared to a full tile
 */
function drawRectangle(x, y, tileW, tileH, clr, size) {
    // coords of top left corner
    top_left_x = x + ((1 - size) * 0.5 * tileW);
    top_left_y = y + ((1 - size) * 0.5 * tileH);

    // width and height of rectangle
    w = size * tileW;
    h = size * tileH;

    // draw the rectangle
    ctx.fillStyle = clr;
    ctx.fillRect(top_left_x, top_left_y, w, h);
}

/**
 * Draw a circle on screen
 *
 * @param {int} x: x location of tile (top left)
 * @param {int} y: y location of tile (top left)
 * @param {int} tileW: width of normal tile
 * @param {int} tileH: height of normal tile
 * @param {str} clr: colour to be used to fill the figure
 * @param {float} size: size ratio (0-1) of this tile compared to a full tile
 */
function drawCircle(x, y, tileW, tileH, clr, size) {
    // coords of top left corner
    top_x = x + 0.5 * tileW;
    top_y = y + 0.5 * tileH;

    // width and height of rectangle
    w = size * tileW;
    h = size * tileH;

    // draw the rectangle
    // ctx.fillRect( top_left_x, top_left_y, w, h);
    ctx.beginPath();
    ctx.arc(top_x, top_y, w * 0.5, 0, 2 * Math.PI);
    ctx.closePath();

    // fill the shape with colour
    ctx.fillStyle = clr;
    ctx.fill();
}

function drawImage(imgName, x, y, tileW, tileH, size) {
    var img = new Image();
    var src = img.src = window.location.origin + '/static/avatars/' + imgName;
    top_left_x = x + ((1 - size) * 0.5 * tileW);
    top_left_y = y + ((1 - size) * 0.5 * tileH);

    // width and height of rectangle
    w = size * tileW;
    h = size * tileH;
    if (parsedGifs.hasOwnProperty(img.src) && parsedGifs[img.src].hasOwnProperty("currFrame")) {
        var currFrame = parsedGifs[src]["currFrame"];
        img = parsedGifs[src][currFrame];
        currFrame++;
        if (currFrame >= parsedGifs[src].length) {
            currFrame = 0;
        }
        parsedGifs[src]["currFrame"] = currFrame;
    }
    ctx.drawImage(img, top_left_x, top_left_y, w, h); // DRAW THE IMAGE TO THE CANVAS.
}

/**
 * Draw a triangle on screen
 *
 * @param {int} x: x location of tile (top left)
 * @param {int} y: y location of tile (top left)
 * @param {int} tileW: width of normal tile
 * @param {int} tileH: height of normal tile
 * @param {str} clr: colour to be used to fill the figure
 * @param {float} size: size ratio (0-1) of this tile compared to a full tile
 */
function drawTriangle(x, y, tileW, tileH, clr, size) {
    // calc the coordinates of the top corner of the triangle
    topX = x + 0.5 * tileW;
    topY = y + ((1 - size) * 0.5 * tileH);

    // calc the coordinates of the bottom left corner of the triangle
    bt_leftX = x + ((1 - size) * 0.5 * tileW);
    bt_leftY = y + tileH - ((1 - size) * 0.5 * tileH);

    // calc the coordinates of the bottom right corner of the triangle
    bt_rightX = x + tileW - ((1 - size) * 0.5 * tileW);
    bt_rightY = y + tileH - ((1 - size) * 0.5 * tileH);

    // draw triangle point by point
    ctx.beginPath();
    ctx.moveTo(topX, topY); // center top
    ctx.lineTo(bt_leftX, bt_leftY); // bottom left
    ctx.lineTo(bt_rightX, bt_rightY); // bottom right
    ctx.closePath();

    // fill the shape with colour
    ctx.fillStyle = clr;
    ctx.fill();
}

/**
 * Convert a hexadecimal colour code to an RGBA colour code
 */
function hexToRgba(hex, opacity) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? "rgba(" + parseInt(result[1], 16) + "," + parseInt(result[2], 16) +
        "," + parseInt(result[3], 16) + "," + opacity + ")" : null;
}
