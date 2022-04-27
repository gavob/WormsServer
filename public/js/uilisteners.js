/********************************
 *         GAME START           *
 ********************************/

// Start button listener
$("#createname").click(function() { 
    let newname = $("#username").val();
    let error = null
    // Check if any errors in name input or full lobby
    if(newname == '') error = 'empty';
    for(let i in players) {
        if(players[i]['name'] == newname) error = 'Name already exists';
    }
    if(players.length >= 4) error = 'Lobby Full';
    // If name suitable and space in lobby then enter lobby else display error
    if(error == null) { 
        $("#startscreen").hide();
        $("#lobby").show();
        socket.emit('newname', newname);
    } else {
        $("#nameerror").text(error);
    }
}); 
// Ready checkbox listener
$("#ready").change(function() {
    socket.emit('toggleready', $("#ready").is(":checked"));
});

/********************************
 *          IN-GAME UI          *
 ********************************/

// Skip turn button listener
$("#skipbtn").click(function() {
    socket.emit('skipturn');
});
// Help button controls listener
$("#helpbtn").click(function() {
    if($('#help:visible').length == 0) {
        $('#help').show();
    } else {
        $('#help').hide();
    }
});
// Weapon selection button listeners
$("#rifle").click(function() {
    if(!attackused) {
        socket.emit('equipweapon','rifle');
    }
    $("#rifle").blur()
});
$("#tommy").click(function() {
    if(!attackused) {
        socket.emit('equipweapon','tommy');
    }
    $("#tommy").blur()
});
$("#grnde").click(function() {
    if(!attackused) {
        socket.emit('equipweapon','grenade');
    }
    $("#grnde").blur()
});
$("#axe").click(function() {
    if(!attackused) {
        socket.emit('equipweapon','axe');
    }
    $("#axe").blur()
});
$("#lnchr").click(function() {
    if(!attackused) {
        socket.emit('equipweapon','launcher');
    }
    $("#lnchr").blur()
});

/********************************
 *        GAME CONTROLS         *
 ********************************/

// Listen for keys pressed down
$(document).keydown(function(e) {
    if(myturn) {
        // Drain stamina
        if(weapon == null) stamina--;
        $('#stamina').val(stamina);
        // Jump key listener
        if(e.keyCode == 87 || e.keyCode == 38) {
            if(weapon == null && stamina > 0) socket.emit('move', {'dir':'up','player':myname});
        }
        // Move left or rotate weapon key listner
        if(e.keyCode == 65 || e.keyCode == 37) {
            if(weapon == null) { 
                if(stamina > 0) socket.emit('move', {'dir':'left','player':myname}); // Move if enough stamina  
            } else {
                // Keep weapon rotation value in 0-360 range
                if(weapon.sprite.rotation < 0) {
                    weapon.sprite.rotation += 360;
                } else if(weapon.sprite.rotation  >= 360) {
                    weapon.sprite.rotation  -= 360;
                }
                socket.emit('rotateweapon', 'clockwise');
                // Flip weapon sprite if facing opposite direction
                if(weapon.sprite.rotation > 90 && weapon.sprite.rotation < 270) {
                    weapon.sprite.scaleY = -weaponscaley;
                    players[turn].sprite.scaleX = -1;
                } else {
                    weapon.sprite.scaleY = weaponscaley;
                    players[turn].sprite.scaleX = 1;
                }
            }
        }
        // Move right key listener
        if(e.keyCode == 68 || e.keyCode == 39) {
            if(weapon == null) { 
                if(stamina > 0) socket.emit('move', {'dir':'right','player':myname}); // Move if enough stamina
            } else {
                // Keep weapon rotation value in 0-360 range
                if(weapon.sprite.rotation < 0) {
                    weapon.sprite.rotation += 360;
                } else if(weapon.sprite.rotation  >= 360) {
                    weapon.sprite.rotation  -= 360;
                }
                socket.emit('rotateweapon', 'anticlockwise');
                // Flip weapon sprite if facing opposite direction
                if(weapon.sprite.rotation > 90 && weapon.sprite.rotation < 270) {
                    weapon.sprite.scaleY = -weaponscaley;
                    players[turn].sprite.scaleX = -1;
                } else {
                    weapon.sprite.scaleY = weaponscaley;
                    players[turn].sprite.scaleX = 1;
                }
            }
        }
        // Space key listener
        if(e.keyCode == 32 && weapon !== null) {
            if(!attackused) { // Only if attack hasn't been used this turn
                // if throwable then start charge otherwise fire weapon
                if(weapon.name == 'axe' || weapon.name == 'grenade') {
                    if(throwablecharge < 100) throwablecharge++;
                    $('#weaponcharge').show();
                    $('#weaponcharge').val(throwablecharge);
                } else {
                    // Fire weapon and remove 2 seconds later
                    attackused = true;
                    let angle = weapon.sprite.rotation;
                    socket.emit('shoot',{weapon:weapon.name,angle:angle});
                    setTimeout(function(){ socket.emit('removeweapon'); }, 2000);
                }
                // Remove aim reticule
                stage.removeChild(aimreticule);
                aimreticule = null;
            }
        }
    }
});
// Listen for keys being let up
$(document).keyup(function(e){ 
    if(myturn) {
        // Make player stand if theyve stopped moving left or right
        if(e.keyCode == 65 || e.keyCode == 37) { 
            socket.emit('move', {'dir':'stand','player':myname});
        }
        if(e.keyCode == 68 || e.keyCode == 39) {
            socket.emit('move', {'dir':'stand','player':myname});
        }
        // If player using a throwable weapon and lets go of space then fire projectile
        if(e.keyCode == 32 && !attackused && (weapon.name == 'axe' || weapon.name == 'grenade')) {
            $('#weaponcharge').hide();
            attackused = true;
            let angle = weapon.sprite.rotation;
            socket.emit('shoot',{weapon:weapon.name,angle:angle,charge:throwablecharge});
            setTimeout(function(){ socket.emit('removeweapon'); }, 2000);
            // Reset throw charge
            throwablecharge = -1;
            $('#weaponcharge').val(0);
        }
    }
});