"use strict";
let socket = io();
// EaselJS globals
let easelCan, easelCtx, loader, stage, stageheight, stagewidth;
let timestamps = [];
let framerate = 60;
let datastamps = [];
let objs = [];
let boxes = [];
let players = [];
let spritesheets = [];
let projectiles = [];
let weapon = null;
let boxsprite = null;
let aimreticule;
let explosions = [];
let destroylist = [];
// This client player
let myname;
let myturn = false; 
let inventory = [];
let stamina;
let attackused;
let throwablecharge = -1;
// Game variables
let weaponscalex;
let weaponscaley;
let turn = -1;
let R2D = 180 / Math.PI;
let playersalive;

function init() {
    easelCan = document.getElementById('easelcan');
    easelCtx = easelCan.getContext('2d');
    stage = new createjs.Stage(easelCan);
    stage.snapPixelsEnabled = true;
    stagewidth = stage.canvas.width;
    stageheight = stage.canvas.height;
    let assetPath = './assets/';
    let manifest = [
        {src:'plankv.png', id:'border'},
        {src:'images/background.png', id:'background'},
        {src:'images/playersprites.png', id:'playersprites'},
        {src:'images/tompson.png', id:'tommygun'},
        {src:'images/G43.png', id:'rifle'},
        {src:'images/box.png', id:'box'},
        {src:'images/grenade.png', id:'grenade'},
        {src:'images/IronAxe.png', id:'axe'},
        {src:'images/rlauncher.png', id:'launcher'},
        {src:'images/missile.png', id:'missile'},
        {src:'images/aimsprite.png', id:'aim'},
        {src:'images/explosion.png', id:'explosion'}
    ];
    loader = new createjs.LoadQueue(false);
    loader.addEventListener('complete', handleComplete);
    loader.loadManifest(manifest, true, assetPath);
}

// Game client update
function tick(e) {
    followPlayer(); // Viewport to player with current turn
    if(huddisplayed) positionHUD(); // Set hud elements after initial viewport intro

    // Check for explosion sprites and delete them if theyve finished playing
    for(let i in explosions) { 
        if(explosions[i].paused) {
            destroylist.push(explosions[i]);
            explosions.splice(i,1);
        }
    }

    // Remove sprites from stage
    for(let i in destroylist) {
        stage.removeChild(destroylist[i]);
    }
    destroylist.length = 0;

    // Calculate framerate
    const now = performance.now();
    while(timestamps.length>0 && timestamps[0]<=now-1000) {
        timestamps.shift();
    }
    timestamps.push(now);
    if(timestamps.length<45) {
        framerate = 30;
    } else if(timestamps.length<75) {
        framerate = 60;
    } else if(timestamps.length<105) {
        framerate = 90;
    } else if(timestamps.length<130) {
        framerate = 120;
    } else if(timestamps.length<160) {
        framerate = 144;
    } else {
        framerate = 240;
    }
    createjs.Ticker.framerate = framerate;
    document.getElementById('fps').innerHTML = ' fps ' + framerate;
    stage.update(e);
}

function handleComplete() {
    playersalive = players.length;
    // Background image
    let easelbackground = makeBitmap(
        loader.getResult('background'),
        stagewidth,
        stageheight + 220
    );
    easelbackground.x = 0;
    easelbackground.y = 0;
    stage.addChild(easelbackground);

    // Player animations
    spritesheets.push(
        new createjs.SpriteSheet({
            framerate: 0,
            'images': [loader.getResult('playersprites')],
            'frames': {
                'regX': 16, 'regY': 16,
                'width': 32, 'height': 32,
                'count': 78
            },
            'animations': {
                'stand': [0,1,'stand',0.1],
                'walk': [12,17,'walk',0.5],
                'jump': [59,59,'jump',0.5],
                'die': {
                    frames:[10,11,59,65,71],
                    next:false,
                    speed:0.2
                }
            }
        })
    );

    // Explosion animation
    spritesheets.push(
        new createjs.SpriteSheet({
            framerate: 0,
            'images': [loader.getResult('explosion')],
            'frames': {
                'regX': 50, 'regY': 50,
                'width': 100, 'height': 100,
                'count': 50
            },
            'animations': {
                'explode': [1,49,false,1]
            }
        })
    );

    createjs.Ticker.framerate = framerate;
    createjs.Ticker.timingMode = createjs.Ticker.RAF;
    createjs.Ticker.addEventListener('tick', tick);

    let initialised = false;
    // Run everytime box2d object data is emitted from server
    socket.on('objdata', function(data){
        let projectile = 0;

        for(let i in data) {
            // Create border block sprite
            if(!initialised && data[i].id == 'bord') {
                objs.push({
                    name:data[i].name,
                    sprite:makeBitmap(
                        loader.getResult('border'),
                        data[i].objwidth,
                        data[i].objheight
                    )
                });
                stage.addChild(objs[objs.length-1]['sprite']);
            }
            // Create ground block sprite
            if(!initialised && data[i].id == 'block') {
                objs.push({
                    name:data[i].name,
                    sprite:makeGround(
                        data[i].objwidth,
                        data[i].objheight
                    )
                });
                stage.addChild(objs[objs.length-1]['sprite']);
                
                objs[objs.length-1]['sprite'].x = data[i].x;
                objs[objs.length-1]['sprite'].y = data[i].y;
            }
            // Create weapon box sprite
            if(!initialised && data[i].id == 'box') {
                boxes.push({
                    name:data[i].name,
                    sprite:makeBitmap(
                        loader.getResult('box'),
                        data[i].objwidth,
                        data[i].objheight
                    )
                });
                stage.addChild(boxes[boxes.length-1]['sprite']);
            }
            // Create player sprite
            if(!initialised && data[i].id == 'player') {
                for(let j in players) {
                    if(players[j].name == data[i].name) {
                        console.log('trying');
                        players[j]['sprite'] = new createjs.Sprite(spritesheets[0], "stand");
                        stage.addChild(players[j].sprite);
                    }
                }
            } 
            // Update postion or create projectile sprite
            if(data[i].id == 'bullet') {
                projectile++;
                let bulletobj = false;

                for(let j in projectiles) {
                    if(projectiles[j].name == data[i].name) {
                        bulletobj = true
                        projectiles[j].sprite.x = data[i].x;
                        projectiles[j].sprite.y = data[i].y;
                        projectiles[j].sprite.rotation = data[i].r * (180/Math.PI);
                    }
                }
                if(!bulletobj) {
                    createProjectile(data[i]);
                } 
            }
            // Update player sprite position
            if(data[i].id == 'player') {
                for(let j in players) { 
                    if(data[i].name == players[j].name) {
                        players[j].sprite.x = data[i].x;
                        players[j].sprite.y = data[i].y;
                        break;
                    }
                }
            }
            // Update ground block sprite position
            if(data[i].id == 'block') {
                for(let j in objs) {
                    if(data[i].name == objs[j]['name']) {
                        objs[j]['sprite'].y = data[i].y;
                        break;
                    }
                }
            }
            // Update weapon box sprite position
            if(data[i].id == 'box') {
                for(let j in boxes) {
                    if(data[i].name == boxes[j]['name']) {
                        boxes[j]['sprite'].x = data[i].x;
                        boxes[j]['sprite'].y = data[i].y;
                        break;
                    }
                }
            }
        }
        // If there are more projectile sprites than projectile objects then remove a sprite
        if(projectiles.length>projectile) {
            destroylist.push(projectiles[projectiles.length-1].sprite);
            projectiles.splice(projectiles.length-1,1);
        }

        const now = performance.now();
        while(datastamps.length>0 && datastamps[0] <= now - 1000) {
            datastamps.shift();
        }
        datastamps.push(now);
        document.getElementById('datarate').innerHTML = ' datarate ' + datastamps.length;

        initialised = true;
    });
    
}
// Creates a projectile with the box2d object data to customise sprite and sound effect
function createProjectile(obj) {
    let sprite, sfx;
    switch(weapon.name) {
        case 'tommy':
            sprite = makeBullet(obj.objwidth, obj.objheight);
            // tommy fires 3 bullets but we only want first to play sound clip
            if($('#tommyaudio')[0].paused)sfx = $('#tommyaudio')[0]; 
            break;
        case 'rifle':
            sprite = makeBullet(obj.objwidth, obj.objheight);
            sfx = $('#gunshotaudio')[0];
            break;
        case 'axe':
            sprite = makeBitmap(loader.getResult('axe'),obj.objwidth,obj.objheight);
            sfx = $('#axeaudio')[0];
            break;
        case 'grenade':
            sprite = makeBitmap(loader.getResult('grenade'),obj.objwidth,obj.objheight);
            break;
        case 'launcher':
            sprite = makeBitmap(loader.getResult('missile'),obj.objwidth,obj.objheight);
            sfx = $('#launcheraudio')[0];
    }

    projectiles.push({
        name: obj.name,
        sprite: sprite
    });

    stage.addChild(projectiles[projectiles.length-1].sprite);
    projectiles[projectiles.length-1].sprite.x = obj.x;
    projectiles[projectiles.length-1].sprite.y = obj.y;
    projectiles[projectiles.length-1].sprite.rotation = obj.r * (180 / Math.PI);

    if(sfx) sfx.play();
}

function startGame() {
    init();
    $("#lobby").hide();
    $("#game").show();
}

function endGame() {
    let placements = document.getElementsByClassName("endplace");

    for(let i in players) {
        if(players[i].finished == null) { // Last surving player has no finished value
            if(players[i].name == myname) { // Check if winner is this client
                $('#endresult').text('You won the match!');
                $('#winimg').show();
            } else { 
                $('#endresult').text(players[i].name+' is the winner');
                $('#loseimg').show();
            }
        } else {
            placements[players[i].finished-2].innerHTML = players[i].finished + '. ' + players[i].name;
        }
    }

    // Delay 2 seconds till the end screen and leave it up for 3 before resetting the game
    setTimeout(function() { 
        $('#game').hide();
        $('#endgame').show();
        setTimeout(function() { 
            socket.emit('resetgame');
        }, 3000);
    }, 2000);
}

function resetGame() {
    location.reload(); // Reload this page
}

// Position nametags, healthbars, throwable charge bar, weapon and aim reticule sprites
function positionHUD() {
    let nametags = document.getElementsByClassName("nametag");
    // Position nametags and healthbars
    for(let i in players) {
        nametags[i].style.top = (
            players[i].sprite.y +
            parseInt($('#easelcan').css('top'))
            - 55
        ) + 'px';
        
        nametags[i].style.left = (
            players[i].sprite.x +
            parseInt($('#easelcan').css('left'))
            - (parseInt(nametags[i].getBoundingClientRect().width)/2)
        ) + 'px';
        
        $('#'+players[i].name).css({
            top:(
                players[i].sprite.y +
                parseInt($('#easelcan').css('top'))
                - 30
            ) + 'px', 
            left: (players[i].sprite.x +
                parseInt($('#easelcan').css('left'))
                - (parseInt($('#'+players[i].name).width())/2)
            ) + 'px'
        });

    }

    // Position throwable charge bar, weapon or aim reticule if it is being used
    if(throwablecharge >= 0) {
        let weaponcharge = document.getElementById("weaponcharge");
        weaponcharge.style.top= (
            players[turn].sprite.y +
            parseInt($('#easelcan').css('top'))
            + 30
        ) +'px';
        
        weaponcharge.style.left= (
            players[turn].sprite.x +
            parseInt($('#easelcan').css('left'))
            - (parseInt(weaponcharge.getBoundingClientRect().width)/2)
        ) +'px';
    }
    if(weapon) {
        weapon.sprite.x = players[turn].sprite.x;
        weapon.sprite.y = players[turn].sprite.y+5;
    }
    if(aimreticule) {
        aimreticule.x =  players[turn].sprite.x;
        aimreticule.y =  players[turn].sprite.y;
    }
}

/********************************
 *    Easel Helper Functions    *
 ********************************/
function makeBitmap(ldrimg, b2x, b2y, yadjust=0) {
    let theimage = new createjs.Bitmap(ldrimg);
    let scalex = (b2x*2)/theimage.image.naturalWidth;
    let scaley = (b2y*2)/theimage.image.naturalHeight;
    theimage.scaleX = scalex;
    theimage.scaleY = scaley;
    theimage.regX = theimage.image.width/2;
    theimage.regY = theimage.image.height/2 - yadjust;
    return theimage;
}

function makeGround(b2x, b2y) {
    let graphics = new createjs.Graphics().beginFill("#33aa33").drawRect(0, 0, b2x*2, b2y*2); 
    let theimage = new createjs.Shape(graphics);
    theimage.regX = b2x/2;
    theimage.regY = b2y;
    return theimage;
}

function makeBullet(b2x, b2y) {
    let graphics = new createjs.Graphics().beginFill("#eff542").drawRect(0, 0, b2x, b2y);
    let theimage = new createjs.Shape(graphics);
    theimage.regX = b2x/2;
    theimage.regY = b2y/2;
    return theimage;
}

function makeAimReticule(b2x, b2y) {
    let theimage = new createjs.Bitmap(loader.getResult('aim'));
    let scalex = (b2x*2)/theimage.image.naturalWidth;
    let scaley = (b2y*2)/theimage.image.naturalHeight;
    theimage.scaleX = scalex;
    theimage.scaleY = scaley;
    theimage.regX = 0; // Set reg to 0 so that it can be rotate around one point
    theimage.regY = theimage.image.height/2;
    return theimage;
}