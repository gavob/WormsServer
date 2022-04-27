'use strict';
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const Box2D = require('box2dweb-commonjs').Box2D;

let b2Vec2 = Box2D.Common.Math.b2Vec2;
let b2AABB = Box2D.Collision.b2AABB;
let b2BodyDef = Box2D.Dynamics.b2BodyDef;
let b2Body = Box2D.Dynamics.b2Body;
let b2FixtureDef = Box2D.Dynamics.b2FixtureDef;
let b2Fixture = Box2D.Dynamics.b2Fixture;
let b2World = Box2D.Dynamics.b2World;
let b2MassData = Box2D.Collision.Shapes.b2MassData;
let b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape;
let b2CircleShape = Box2D.Collision.Shapes.b2CircleShape;
let b2ChainShape = Box2D.Collision.Shapes.b2ChainShape;
let b2DebugDraw = Box2D.Dynamics.b2DebugDraw;
let b2MouseJointDef = Box2D.Dynamics.Joints.b2MouseJointDef;
let b2EdgeShape = Box2D.Collision.Shapes.b2EdgeShape;

let listener = new Box2D.Dynamics.b2ContactListener;

let connections=[];
let world;
const SCALE = 30;
const WIDTH = 1600;
const HEIGHT = 1000;
const SIZE = 50;
let fps = 65;
let intervals = [];
let movements = [];
let bullets = [];
let blockshift = [];
let destroylist = [];
let onground = true;
let currentplayer;
let fireready = true;
let playerdamage = [];

let clockcounter;
let gamestart = false;
let activegrenade = false;

function drawDOMObjects() {
    let ret = [];
    for(let b = world.GetBodyList(); b; b=b.GetNext()) {
        for(let f = b.GetFixtureList(); f; f = f.GetNext()) {
            let id = f.GetBody().GetUserData().id;
            let name = f.GetBody().GetUserData().name;
            let x = Math.round(f.GetBody().GetPosition().x*SCALE);
            let y = Math.round(f.GetBody().GetPosition().y*SCALE);
            let r = Math.round(f.GetBody().GetAngle()*100)/100;
            let iscircle = f.GetBody().GetUserData().iscircle;
            let objwidth = Math.round(f.GetBody().GetUserData().width);
            let objheight = Math.round(f.GetBody().GetUserData().height);
            ret.push({
                id:id,
                name:name,
                x:x,
                y:y,
                r:r,
                iscircle:iscircle,
                objheight:objheight,
                objwidth:objwidth
            });
        }
    }
    return ret;
}

// Standard body creation function 
function createAnObject(objid,name,x,y,dims,iscircle,isstatic) {
    let bodyDef = new b2BodyDef;
    bodyDef.type = isstatic ? b2Body.b2_kinematicBody : b2Body.b2_dynamicBody;
    bodyDef.position.x = x/SCALE;
    bodyDef.position.y = y/SCALE;
    let fixDef = new b2FixtureDef;
    fixDef.density = 1.5;
    fixDef.friction = 1;
    fixDef.restitution = 0;

    let width, height;
    if(iscircle) { // circle
        fixDef.shape = new b2CircleShape(dims.radius/SCALE);
        width = dims.radius*2;
        height = dims.radius*2;
    } else { // rectangle
        fixDef.shape = new b2PolygonShape;
        fixDef.shape.SetAsBox(dims.width/SCALE, dims.height/SCALE);
        width = dims.width;
        height = dims.height;
    }

    let thisobj = world.CreateBody(bodyDef).CreateFixture(fixDef);
    thisobj.GetBody().SetUserData({
        id:objid,
        name:name,
        width:width,
        height:height,
        iscircle:iscircle
    });
    return thisobj;
}

// projectile body creation function 
function createBulletObject(objid,name,x,y,dims,angle,iscircle) {
    let bodyDef = new b2BodyDef;
    bodyDef.type = b2Body.b2_dynamicBody; 
    bodyDef.position.x = x/SCALE;
    bodyDef.position.y = y/SCALE;
    bodyDef.angle = angle;
    let fixDef = new b2FixtureDef;
    fixDef.density = 0.2;
    fixDef.friction = 1;
    fixDef.restitution = 0;

    let width, height;
    if(iscircle) { // circle
        fixDef.density = 2;
        fixDef.shape = new b2CircleShape((dims.width/2)/SCALE);
        width = dims.width;
        height = dims.height;
    } else { // rectangle
        fixDef.shape = new b2PolygonShape;
        fixDef.shape.SetAsBox(dims.width/SCALE, dims.height/SCALE);
        width = dims.width;
        height = dims.height;
    }

    bodyDef.isBullet = true;
    let thisobj = world.CreateBody(bodyDef).CreateFixture(fixDef);
    thisobj.GetBody().SetUserData({
        id:objid,
        name:name,
        width:width,
        height:height,
        iscircle:iscircle 
    });
    return thisobj;
}

function changeUserData(target, property, newvalue) {
	let currentData = target.GetBody().GetUserData();
	currentData[property] = newvalue;
	target.GetBody().SetUserData(currentData);
}

function getPlayerObj() {
    for(let b=world.GetBodyList(); b; b=b.GetNext()) { 
        for(let f=b.GetFixtureList(); f; f=f.GetNext()) {
            if(f.GetBody().GetUserData().name == currentplayer) {
                return f;
            }
        }
    }
}

function damagePlayer(pdamage) {
    let player = pdamage.player;
    let damage = pdamage.damage;
    let newhealth = player.GetBody().GetUserData().health - damage;
    
    changeUserData(player, 'health', newhealth);
    if(newhealth < 0) newhealth = 0; 
    // update clients with players new health value
    io.sockets.emit('damageplayer', {
        player: player.GetBody().GetUserData().name,
        health: newhealth
    });
}

function explosion(eX, eY) {
    let area = 40/SCALE; // set explosion area
    for(let b = world.GetBodyList(); b; b=b.GetNext()) {
        for(let f = b.GetFixtureList(); f; f = f.GetNext()) {
            let bX = f.GetBody().GetPosition().x;
            let bY, distance, force;
            
            if(f.GetBody().GetUserData().id == 'block') {
                bY = f.GetBody().GetPosition().y - (300/SCALE);

                if((eX>bX-area && eX<bX+area) && (eY>bY-area)) { // Check if ground block is in explosion radius
                    distance = Math.round(Math.sqrt(((eX-bX)**2)+((eY-bY)**2))*SCALE); // Get distance from blast
                    force = (40 - distance > 0) ? 40 - distance : 0; // Max force of 40, min 0
                    // send block to be moved
                    blockshift.push({
                        name: f.GetBody().GetUserData().name, 
                        force: force
                    });
                }
            } else if(f.GetBody().GetUserData().id == 'player') {
                bY = f.GetBody().GetPosition().y;

                if((eX>bX-area && eX<bX+area) && (eY>bY-area && eY<bY+area)) { // Check if player is in explosion radius
                    distance = Math.round(Math.sqrt(((eX-bX)**2)+((eY-bY)**2))*SCALE); // Get distance from blast
                    force = (30 - distance > 0) ? 30 - distance : 0; // Max force of 40, min 0

                    f.GetBody().ApplyImpulse(new b2Vec2(0, -1), f.GetBody().GetWorldCenter()); // Apply force to player
                    // Send damage to player
                    playerdamage.push({
                        player: f,
                        damage: force + 10
                    });
                }
            }  
        }
    }
}

// Takes the name of a ground block and moves a set distance downwards
function shiftBlock(name, force) {
    for(let b = world.GetBodyList(); b; b=b.GetNext()) {
        for(let f = b.GetFixtureList(); f; f = f.GetNext()) {
            if(name == f.GetBody().GetUserData().name) {
                console.log('move block ' + name);
                f.GetBody().SetPosition(
                    new b2Vec2(
                        f.GetBody().GetPosition().x,
                        f.GetBody().GetPosition().y + (force / SCALE)), 
                        f.GetBody().GetWorldCenter()
                    );
                return;
            }
        }
    }
}

function fireWeapon(bullet) {
    let player = getPlayerObj();
    let angle = bullet.angle * (Math.PI/180); // Shooting angle is converted to radians
   
    // Get position of the end of guns barrel
    let bx = player.GetBody().GetPosition().x*SCALE + (30 * Math.cos(angle));
    let by = player.GetBody().GetPosition().y*SCALE + (30 * Math.sin(angle));

    let vector, power, iscircle, bwidth, bheight;
    if(bullet.weapon == 'tommy' || bullet.weapon == 'rifle') { // Guns that fire bullets
        power = 10;
        iscircle = false;
        bwidth = 12;
        bheight = 3;
    } else if(bullet.weapon == 'axe' || bullet.weapon == 'grenade') { // Throwable projectiles
        console.log('CIRCLE projectile charge = '+bullet.charge/20);
        iscircle = true;
        if(bullet.weapon == 'axe') { // axe
            power = bullet.charge/10;
            bwidth = 10;
            bheight = 10;
        } else { // grenade
            power = bullet.charge/30;
            bwidth = 7;
            bheight = 7;
        }
    } else if(bullet.weapon == 'launcher') { // Rocket launcher
        power = 1;
        iscircle = false;
        bwidth = 15;
        bheight = 5;
    }
    // A vector in direction player is facing for projectile force
    vector = new b2Vec2(Math.cos(angle)*power, Math.sin(angle)*power); 
    // Create projectile object
    let bulletobj = createBulletObject(
        'bullet',bullet.name,
        bx, by,
        {width: bwidth, height: bheight},
        angle,
        iscircle
    );
    // Apply force to projectile
    bulletobj.GetBody().ApplyImpulse(vector, bulletobj.GetBody().GetWorldCenter());
    if(iscircle) bulletobj.GetBody().SetAngularVelocity(20); // If throwable set it to spin through air
}

function resetLobby() {
    let lobby = [];
    for(let i in connections) {
        if(connections[i]['ready'] !== null) {
            lobby.push({
                name: connections[i]['name'],
                ready: connections[i]['ready']
            });
        }
    }
    io.sockets.emit('updatelobby', lobby);
}

// Check if theres atleast 2 players and that all are ready then start the game
function checkLobbyReady() {
    let playerCount = 0;
    let allReady = true;
    
    for(let i in connections) {
        if(connections[i]['ready'] !== null) {
            playerCount++;
            if(connections[i]['ready'] == false) allReady = false;
        }
    }
    if(allReady && playerCount >= 2) {
        io.sockets.emit('gameready');
        startGame();
    }
}

function startGame() {
    gamestart = true;
    init();
}

// Remove game intervals and reset connections
function resetGame() {
    gamestart = false;
    for(let i in intervals) {
        clearInterval(intervals[i]);
    }
    intervals.length = 0;
    for(let i in connections) {
        connections[i].name = connections[i].socket.id;
        connections[i].ready = null;
    }
}

function movePlayer(name, move) { ///////////////////////////////////////////////////////////////
    let player = getPlayerObj();
    let movement;

    // Set damping to zero for smooth movement
    player.GetBody().SetLinearDamping(0);
    player.GetBody().SetAngularDamping(0);

    switch(move) {
        case 'up':
            if(onground) { // only jump if player is on the ground
                player.GetBody().ApplyImpulse( 
                    new b2Vec2(0, -5),
                    player.GetBody().GetWorldCenter()
                );
                onground = false;
            }
            break;
        case 'left':
            console.log(player.GetBody().GetLinearVelocity());
            movement = new b2Vec2(-3, player.GetBody().GetLinearVelocity().y);
            break;
        case 'right':
            console.log(player.GetBody().GetLinearVelocity());
            movement = new b2Vec2(3, player.GetBody().GetLinearVelocity().y);
            break;
        case 'stand':
            player.GetBody().SetAngularVelocity(0);
            player.GetBody().SetLinearVelocity(new b2Vec2(0,0), player.GetBody().GetWorldCenter());
    }

    if(movement) {
        player.GetBody().ApplyImpulse(new b2Vec2(0,0), player.GetBody().GetWorldCenter()); // incase body is asleep
        player.GetBody().SetLinearVelocity( 
            movement,
            player.GetBody().GetWorldCenter()
        );
    }
}

// Game update tick
function update() {
    world.Step(
        1/fps,
        10,
        10
    );
    // Move ground blocks
    for (let i in blockshift) {
        shiftBlock(blockshift[i]['name'],blockshift[i]['force']);
    }
    blockshift.length = 0;
    // Fire weapon
    if(bullets.length > 0 && fireready) {
        fireWeapon(bullets[bullets.length-1]);
        bullets.pop();
        fireready = false; // used for delay between tommy gun bullets
    }
    // Damage player
    for(let i in playerdamage) {
		damagePlayer(playerdamage[i]);
	}
	playerdamage.length = 0;
    // Destroy b2 bodies
    for(let i in destroylist) {
		world.DestroyBody(destroylist[i]);
	}
	destroylist.length = 0;
    // Move player body
    for (let i in movements) {
        movePlayer(movements[i]['player'], movements[i]['dir']);
    }
    movements.length = 0;

    io.sockets.emit('objdata', drawDOMObjects());
    world.ClearForces();
}

function init() {
    world = new b2World(
        new b2Vec2(0, 9.81),
        true
    );

    // Borders
    //createAnObject('bord',0,0,{width:WIDTH,height:5},false,true);
    //createAnObject('bord',0,HEIGHT,{width:WIDTH,height:5},false,true);
    createAnObject('bord','bord',0,0,{width:5,height:HEIGHT},false,true);
    createAnObject('bord','bord',WIDTH,0,{width:5,height:HEIGHT},false,true);
    
    // Game Environment
    let hills = 3;
    let max = 10;
    let gheight = 100;
    let incline = false;
    let flat = false;
    // Generate ground blocks
    for(let i=0; i<320; i++) {
        if(i % Math.round((320 / (hills * 4))) == 0) flat = !flat;
        if(i % Math.round((320 / (hills * 2))) == 0) incline = !incline;
        if(!flat) {
            if(incline) gheight += Math.random() * max;
            else gheight -= Math.random() * max;
        }
        createAnObject('block',i+1,i*5,HEIGHT-gheight,{width:2.5,height:300},false,true);
    }

    // Weapon boxes
    createAnObject('box','box0',40,300,{width:10,height:10},false,false);
    createAnObject('box','box1',WIDTH/3,300,{width:10,height:10},false,false);
    createAnObject('box','box2',WIDTH/2,300,{width:10,height:10},false,false);
    createAnObject('box','box3',(WIDTH/3)*2,300,{width:10,height:10},false,false);
    createAnObject('box','box4',WIDTH-40,300,{width:10,height:10},false,false);

    // Players
    let playerCount = 0;
    for(let i in connections) {
        if(connections[i]['ready'] == true) {
            playerCount++;
            let newplayer = createAnObject('player',
                connections[i]['name'],
                (WIDTH/5)*playerCount,
                50,
                {
                    radius: 14
                },
                true,
                false
            );
            changeUserData(newplayer,'health',100);
            io.to(connections[i].socket.id).emit('assignname', connections[i].name); // Send name to each client
        }
    }

    // Collision Listener
    listener.BeginContact= function(contact) {
        let fixa=contact.GetFixtureA().GetBody().GetUserData();
        let fixb=contact.GetFixtureB().GetBody().GetUserData();
        // Check for player and ground collision
        if((fixa.name == currentplayer && fixb.id == 'block') 
        || (fixb.name == currentplayer && fixa.id == 'block')) {
            if(!onground) io.sockets.emit('playeranimate', 'stand');
            onground = true;
            console.log('ONGROUND');
        }
        // Collsion involves a bullet
        if(fixa.id == 'bullet' || fixb.id == 'bullet') {
            let bullet, target, weapondamage;
            if(fixa.id == 'bullet') {
                bullet = contact.GetFixtureA().GetBody();
                target = contact.GetFixtureB();
            } else {
                bullet = contact.GetFixtureB().GetBody();
                target = contact.GetFixtureA();
            }
            // If from rocket launcher then create an explosion
            if(bullet.GetUserData().name == 'launcher') {
                explosion(bullet.GetPosition().x,bullet.GetPosition().y);
                io.sockets.emit('explosion', {
                    area: 40,
                    x: bullet.GetPosition().x*SCALE, 
                    y: bullet.GetPosition().y*SCALE
                });
            }
            // If from grenade then explode after a delay
            if(bullet.GetUserData().name == 'grenade') {   
                if(!activegrenade) {
                    setTimeout(function(){
                        explosion(bullet.GetPosition().x,bullet.GetPosition().y);
                        io.sockets.emit('explosion', {
                            area: 40, 
                            x: bullet.GetPosition().x*SCALE, 
                            y: bullet.GetPosition().y*SCALE
                        });
                        destroylist.push(bullet);
                        activegrenade = false; 
                    }, 2500);
                }
                activegrenade = true;
            } else destroylist.push(bullet); //destroy the projectile
            
            // Damage player
            if(target.GetBody().GetUserData().id == 'player' && target.GetBody().GetUserData().health > 0) {
                // Custom damage according to projectile type
                switch(bullet.GetUserData().name) {
                    case 'rifle': weapondamage = 20;
                        break;
                    case 'axe': weapondamage = 30;
                        break;
                    case 'launcher': weapondamage = 20;
                        break;
                    case 'grenade': weapondamage = 5;
                        break;
                    default: weapondamage = 10;
                }
                playerdamage.push({
                    player: target,
                    damage: weapondamage
                });
            }
        }
        // When player collides with weapon box
        if((fixa.id=='box'&&fixb.id=='player')||(fixb.id=='box'&&fixa.id=='player')) { 
            let box, player;
            if(fixa.id == 'box') {
                box = contact.GetFixtureA().GetBody();
                player = contact.GetFixtureB().GetBody().GetUserData().name;
            } else {
                box = contact.GetFixtureB().GetBody();
                player = contact.GetFixtureA().GetBody().GetUserData().name;
            }
            // Open box for player
            if(player == currentplayer) {
                io.sockets.emit('openbox', {player: player, box: box.GetUserData().name})
                destroylist.push(box);
            }
        }
    }
    world.SetContactListener(listener);

    clockcounter = 5; // Set game clock
    // interval for tommy gun fire
    intervals.push(setInterval(function() {
        if(!fireready) fireready = true;
    }, 100));
    // game clock
    intervals.push(setInterval(function() {
        if(clockcounter == 0) clockcounter = 30
        else clockcounter--;
        io.sockets.emit('gameclock', clockcounter);
    }, 1000));
    // game update tick
    intervals.push(setInterval(function() {
        update();
    }, 1000/fps));
    update();
}

/***************************************************
 *               CLIENT LISTENERS                  *
 ***************************************************/

app.use(express.static('public'));
app.use('/js', express.static(__dirname+'public/js'));
app.use('/css', express.static(__dirname+'public/css'));
app.use('/assets', express.static(__dirname+'public/assets'));

http.listen(8000, function() {
    console.log('server up on *:8000');
    
    // Run on new connection
    io.on('connection', function(socket){ 
        connections.push({socket:socket, name:socket.id, ready:null});
        console.log(socket.id+ 'connected');

        // If the game hasnt started reset the lobby else sent client to waiting room
        if(!gamestart) {
            resetLobby();
        } else {
            io.to(socket.id).emit('waitingroom');
        }

        // Set client ready state and reset lobby
        socket.on('toggleready', (ready)=> {
            let i = connections.findIndex(element => element.socket.id == socket.id);
            connections[i].ready = ready;
            resetLobby();
            checkLobbyReady();
        });

        // Save client created name, save to connection and send them into the lobby
        socket.on('newname', (name) => {
            for(let i in connections) {
                if(connections[i]['name'] == socket.id) {
                    connections[i]['name'] = name;
                    connections[i]['ready'] = false;
                    break;
                } 
            }
            io.sockets.emit('enterlobby', name);
        });

        // Send movement to be applied to body and animation to the clients
        socket.on('move', (e) => {
            movements.push({
                'player':e['player'],
                'dir':e['dir']
            }); 
            if(onground) { // Dont change player animation if in the air
                io.sockets.emit('playeranimate', e['dir']);
            }
        });

        socket.on('currentplayer', (name) => { 
            currentplayer = name;
        });

        socket.on('skipturn', () => { 
            clockcounter = 1;
        });

        socket.on('shoot', (shoot) => { 
            let i = connections.findIndex(element => element.socket.id == socket.id);
            let player = connections[i].name;

            if(shoot.weapon == 'tommy') { // If tommy gun then it fires 3 projectiles
                for(let i=0; i<3; i++)
                    bullets.push({player:player, name:shoot.weapon+i, weapon:shoot.weapon, angle:shoot.angle});
            } else if(shoot.weapon == 'grenade' || shoot.weapon == 'axe') { // If throwable then pass charge
                bullets.push({player:player, name:shoot.weapon, weapon:shoot.weapon, angle:shoot.angle, charge:shoot.charge});
            } else {
                bullets.push({player:player, name:shoot.weapon, weapon:shoot.weapon, angle:shoot.angle});
            } 
                
        });

        // If equiping a weapon then get that players body and send to clients that they equip given weapon
        socket.on('equipweapon', (weapon) => { 
            let player = getPlayerObj();
            player.GetBody().SetLinearVelocity(new b2Vec2(0,0), player.GetBody().GetWorldCenter());
            io.sockets.emit('equipweapon', weapon);
        });

        socket.on('removeweapon', () => { 
            io.sockets.emit('removeweapon');
        });

        socket.on('removeboxsprite', () => { 
            io.sockets.emit('removeboxsprite');
        });

        socket.on('rotateweapon', (direction) => { 
            io.sockets.emit('rotateweapon', direction);
        });

        // Reset game on server and clients
        socket.on('resetgame', () => { 
            resetGame();
            io.sockets.emit('resetgame');
        });

        // Runs on player disconnecting
        socket.on('disconnect', () => {
            console.log(socket.id + ' disconnected');
            let player;
            // Get name of disconnecting player
            for(let i in connections) {
                if(connections[i].socket.id == socket.id) player = connections[i].name;
            }
            // Remove connection
            connections =  connections.filter(element => element.socket.id !== socket.id);
            
            // Reset the lobby or delete player if game running
            if(gamestart) {
                // Delete player body
                for(let b=world.GetBodyList(); b; b=b.GetNext()) { // is this really that necessary
                    for(let f=b.GetFixtureList(); f; f=f.GetNext()) {
                        if(f.GetBody().GetUserData().name==player) {
                            destroylist.push(f.GetBody());
                        }
                    }
                }
                // Delete player from client side
                io.sockets.emit('removeplayer', player);
            } else {
                resetLobby();
            }
        });
    });
});