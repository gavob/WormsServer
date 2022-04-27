/********************************
 *       SERVER LISTENERS       *
 ********************************/

socket.on('assignname', function(name) {
    myname = name;
});

socket.on('gameready', function(){
    startGame();
});

socket.on('resetgame', function(){
    resetGame();
});

socket.on('waitingroom', function(){
    $("#startscreen").hide();
    $("#waitingroom").show();
});

// If client enters lobby then insert them onto players array and update ui
socket.on('enterlobby', function(name){
    let tnames = document.getElementsByClassName("pname");
    let tready = document.getElementsByClassName("pready");
    
    players.push({name: name, sprite: null, finished: null});
    tnames[players.length-1].innerHTML = name;
    tready[players.length-1].innerHTML = '<span class="material-icons">highlight_off</span>';

    if(players.length >= 2) $("#lobbystate").text("Waiting for all players to be ready...");
    else $("#lobbystate").text("Waiting for players to connect...");
    $("#playernum").text(players.length);
});

// Reset lobby ui and players array
socket.on('updatelobby', function(lobby){
    let tnames = document.getElementsByClassName("pname");
    let tready = document.getElementsByClassName("pready");

    players.length = 0;
    for(let i in lobby) {    
        players.push({name: lobby[i]['name'], sprite: null, finished: null});
        tnames[i].innerHTML = lobby[i]['name'];
        if(lobby[i]['ready']) {
            tready[i].innerHTML = '<span class="material-icons">check_circle_outline</span>';
        } else {
            tready[i].innerHTML = '<span class="material-icons">highlight_off</span>';
        }
    }
    // Empty lobby list ui for any remaining spaces
    for(let i=lobby.length; i<4; i++) {
        tnames[i].innerHTML = '';
        tready[i].innerHTML = '';
    }

    if(lobby.length >= 2) $("#lobbystate").text("Waiting for all players to be ready...");
    else $("#lobbystate").text("Waiting for players to connect...");  
    $("#playernum").text(players.length);
});

// Animate the currently playing player sprite for the given direction theyre moving
socket.on('playeranimate', function(move) {
    switch(move) {
        case 'left':
            players[turn].sprite.scaleX=-1;
            if(players[turn].sprite.currentAnimation !== 'walk') players[turn].sprite.gotoAndPlay("walk");
            break;
        case 'right':
            players[turn].sprite.scaleX=1;
            if(players[turn].sprite.currentAnimation !== 'walk') players[turn].sprite.gotoAndPlay("walk");
            break;
        case 'up':
            players[turn].sprite.gotoAndPlay("jump");
            break;
        default:
            players[turn].sprite.gotoAndPlay("stand");
    }
});

// Listens to game clock ticks
socket.on('gameclock', function(counter) {
    $("#gameclock").text(counter); 
    // Skip current turn if player has used stamina and an attack
    if(stamina <= 0 && attackused) {
        socket.emit('skipturn');
        attackused = false;
    } 
    // On turn end
    if(counter == 0) {
        // Make player whose turn ended stand
        //if(myturn && players[turn].finished == null) socket.emit('move', {'dir':'stand','player':myname});
        // Increment turn
        if(turn >= players.length - 1) turn = 0;
        else turn++;
        // Remove aim reticule if exists
        if(aimreticule) {
            stage.removeChild(aimreticule);
            aimreticule = null;
        }
        // If next player isnt dead then setup game hud else skip to next turn
        if(players[turn].finished == null) {
            if(myname == players[turn].name) {
                myturn = true;
                stamina = 100;
                attackused = false;

                $('.playeractions').show();
                $("#turn").text('It\'s your turn!');
                $('#stamina').val(stamina);
                
                if(weapon !== null) {
                    socket.emit('removeweapon');
                }
                // Load inventory 
                for(let i in inventory) {
                    switch(inventory[i]) {
                        case 'tommy':
                            $('#tommy').show();
                            break;
                        case 'rifle':
                            $('#rifle').show();
                            break;
                        case 'grenade':
                            $('#grnde').show();
                            break;
                        case 'axe':
                            $('#axe').show();
                            break;
                        case 'launcher':
                            $('#lnchr').show();
                    }
                }
        
                socket.emit('currentplayer', myname);
            } else {
                $('.playeractions').hide();
                $('.weaponselection').hide();
                $("#turn").text(players[turn].name + '\'s turn');

                myturn = false;
            }
        } else socket.emit('skipturn');
    }
});

// When player hits box show the weapon as temporary sprite and add that weapon to their inventory
socket.on('openbox', function(openbox) {
    let newweapon;
    switch(openbox.box) {
        case 'box0':
            newweapon = 'rifle';
            boxsprite = makeBitmap(loader.getResult('rifle'), 30, 40);
            if(myname == players[turn].name) $('#rifle').show();
            break;
        case 'box1':
            newweapon = 'grenade';
            boxsprite = makeBitmap(loader.getResult('grenade'), 8, 10);
            if(myname == players[turn].name) $('#grnde').show();
            break;
        case 'box2':
            newweapon = 'launcher';
            boxsprite = makeBitmap(loader.getResult('launcher'), 20, 12);
            if(myname == players[turn].name) $('#lnchr').show();
            break;
        case 'box3':
            newweapon = 'axe';
            boxsprite = makeBitmap(loader.getResult('axe'), 10, 12);
            if(myname == players[turn].name) $('#axe').show();
            break;
        case 'box4':
            newweapon = 'tommy';
            boxsprite = makeBitmap(loader.getResult('tommygun'), 40, 40);
            if(myname == players[turn].name) $('#tommy').show();
    }

    for(let i in boxes) {
        if(boxes[i].name == openbox.box) {
            stage.addChild(boxsprite);
            boxsprite.x = boxes[i].sprite.x;
            boxsprite.y = boxes[i].sprite.y;
            
            stage.removeChild(boxes[i].sprite);
            boxes.splice(i,1);

            setTimeout(function(){ socket.emit('removeboxsprite'); }, 2000);
        }
    }

    if(openbox.player == myname) {
        inventory.push(newweapon);
    }
});

// When player equips weapon load a sprite of it infront of player sprite with aim reticule
socket.on('equipweapon', function(equipped) {
    switch(equipped) {
        case 'rifle':
            weapon = {name:'rifle',sprite:makeBitmap(loader.getResult('rifle'), 27, 36)};
            break;
        case 'tommy':
            weapon = {name:'tommy',sprite:makeBitmap(loader.getResult('tommygun'), 40, 40)};
            break;
        case 'grenade':
            weapon = {name:'grenade',sprite:makeBitmap(loader.getResult('grenade'), 8, 10)};
            break;
        case 'axe':
            weapon = {name:'axe',sprite:makeBitmap(loader.getResult('axe'), 10, 12)};
            break;
        case 'launcher':
            weapon = {name:'launcher',sprite:makeBitmap(loader.getResult('launcher'), 20, 12)};
    }
    stage.addChild(weapon.sprite);
    // Setting weapon scale here from the images, necessary due to different sized sprites being flipped
    weaponscalex = weapon.sprite.scaleX;
    weaponscaley = weapon.sprite.scaleY;
    // position sprite to player
    weapon.sprite.x = players[turn].sprite.x;
    weapon.sprite.y = players[turn].sprite.y+5;
    // Show aim reticule to player using weapon
    if(myname == players[turn].name) {
        aimreticule = makeAimReticule(48, 12);
        stage.addChild(aimreticule);
        aimreticule.x =  players[turn].sprite.x;
        aimreticule.y =  players[turn].sprite.y;
    }
    // Flip weapon sprite if player facing other direction
    if(players[turn].sprite.scaleX == -1) {
        weapon.sprite.scaleY = -weaponscaley;
        weapon.sprite.rotation = 180;
        if(myname == players[turn].name) aimreticule.rotation =  180; 
    }
});

// Remove weapon sprite
socket.on('removeweapon', function(newweapon) {
    if(weapon) {
        stage.removeChild(weapon.sprite);
        weapon = null;
        weaponscaley = 0;
        weaponscalex = 0;
    }
});

// Remove player if they left mid-game
socket.on('removeplayer', function(player) {
    // Get leaving player sprite and delete it and hide their healthbar
    let playersprite = players.filter(element => element.name == player);
    stage.removeChild(playersprite[0].sprite);
    $('#'+player).hide();
    // Skip if it was their turn when they left
    if(player == players[turn].name) socket.emit('skipturn');
    // Update list of players in game hud to indicate theyve left
    let playersdisplay = document.getElementsByClassName("currentplayer");
    let nametags = document.getElementsByClassName("nametag");
    for(let i in playersdisplay) {
        if(playersdisplay[i].innerHTML == player) {
            playersdisplay[i].innerHTML = player + ' (left)';
            nametags[i].style.display = 'none';
        }
    }
    //Remove player from array
    players = players.filter(element => element.name !== player);
    // If only one player left then end the game
    if(players.length == 1) endGame();
});

socket.on('removeboxsprite', function(newweapon) {
    if(boxsprite) {
        stage.removeChild(boxsprite);
        boxsprite = null;
    }
});

// Rotate weapon and aimreticule sprites together
socket.on('rotateweapon', function(direction) {
    if(direction == 'clockwise') {
        weapon.sprite.rotation = weapon.sprite.rotation - 2;
        if(aimreticule) aimreticule.rotation = aimreticule.rotation - 2;
    } else { 
        weapon.sprite.rotation = weapon.sprite.rotation + 2;
        if(aimreticule) aimreticule.rotation = aimreticule.rotation + 2;
    }
    
});

// When player object is damaged then update their health bar
socket.on('damageplayer', function(damage) {
    $('#'+damage.player).val(damage.health);
    $('#'+damage.player).attr('data-label',damage.health);
    // If player has no health left
    if(damage.health <= 0) {
        let place = players.length;
        playersalive = playersalive - 1;
        let i = players.findIndex(element => element.name == damage.player);
        // Find their position game leaderboard
        for(let j in players) {
            if(players[j].finished !== null) { 
                place--; 
            } 
        }
        // Play falling over animation and death sound
        players[i].sprite.gotoAndPlay("die");
        players[i].finished = place;
        $('#aahaudio')[0].play();
        // If theres only one player left alive then end game
        if(playersalive == 1) {
            endGame();
        }
    }
});

// Create explosion animation and play sound effect
socket.on('explosion', function(explosion){
    explosions.push(new createjs.Sprite(spritesheets[1], "explode"));
    explosions[explosions.length-1].x = explosion.x;
    explosions[explosions.length-1].y = explosion.y;
    stage.addChild(explosions[explosions.length-1]);
    $('#explodeaudio')[0].play();
});