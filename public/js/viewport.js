/********************************
 *           VIEWPORT           *
 ********************************/

let initialised = false;
let animationcomplete = false;
let huddisplayed = false;
 
// Initialise content of nametags, healthbars and player list
function displayHud() {
    let nametags = document.getElementsByClassName("nametag");
    let healthbars = document.getElementsByClassName("healthbar");
    let playersdisplay = document.getElementsByClassName("currentplayer");
    $('#currentplayers').show();
    for(let i in players) {
        nametags[i].innerHTML = players[i].name;
        nametags[i].style.display = "block";
        healthbars[i].style.display = "block";
        healthbars[i].id = players[i].name;
        playersdisplay[i].innerHTML = players[i].name;
    }
}
 
function followPlayer() {
    // At start of game the viewport is zoomed out and slowly zooms in before first players turn
    if(!initialised && !animationcomplete) {
        $('#easelcan').css({
            'transform': 'scale(0.7)',
            'top': -160,
            'left': -300
        });
        initialised = true;
        $('#easelcan').animate({
            left:-98,
            top:-262,
            easing:'swing'
        }, {
            duration:5000,
            start: function() {
                $('#easelcan').css({
                    'transform': 'scale(1)',
                    'transition': 'transform 5000ms'
                })
            },
            complete: function() {
                animationcomplete = true;
            } 
        });
    }
    // Runs once players begin
    if(animationcomplete && initialised) {
        if(!huddisplayed) {
            huddisplayed = true;
            displayHud();
        }
        let zoompadding = 100;
        let VP = Object.create({});
        VP.width=$('#viewport').width(); 
        VP.height=$('#viewport').height(); 
        VP.left=parseInt($('#easelcan').css('left'));
        VP.top=parseInt($('#easelcan').css('top'));
        let AW=Object.create({});
        AW.leftpad = 300;
        AW.toppad = 300;
        AW.rightpad = 300;
        AW.bottompad = 150;
        let leftlimitmax = stagewidth-VP.width;
        let leftlimitmin = 0;
        let toplimitmax = stageheight-zoompadding;
        let toplimitmin = zoompadding;
        let leftposition = 0;
        let topposition = 0;
        let playerposx = players[turn].sprite.x;
        let playerposy = players[turn].sprite.y;
        
        // If there is a projectile then follow this instead of player
        if(projectiles.length > 0) {
            playerposx = projectiles[0].sprite.x;
            playerposy = projectiles[0].sprite.y;
            // Reduce padding
            AW.leftpad = 100; 
            AW.rightpad = 100;
            AW.toppad = 100; 
            AW.bottompad = 100;
        }

        let transition = '34ms';
        if(playerposx >= (-VP.left + (VP.width - AW.rightpad))) { // Move viewport right
            if(playerposx - (-VP.left + (VP.width - AW.rightpad)) > 40) transition = '1000ms'; // slow transition if large distance
            leftposition = playerposx+AW.rightpad-VP.width;
        } else if(playerposx<=(-VP.left) + AW.leftpad) { // Move viewport left
            if(((-VP.left) + AW.leftpad) - playerposx > 40) transition = '1000ms'; // slow transition if large distance
            leftposition = playerposx-AW.leftpad;
        } else {
            leftposition = -VP.left;   
        }
        
        if(leftposition<leftlimitmin) leftposition = 0;
        if(leftposition>leftlimitmax) leftposition = 800;
        
        $('#easelcan').css({'left':-leftposition,'transition':'left '+transition}); // Set viewport X position
        
        if(playerposy >= (-VP.top + (VP.height - AW.bottompad))) { // Move viewport down
            topposition = playerposy+AW.bottompad-VP.height;
        } else if(playerposy<=(-VP.top) + AW.toppad) { // Move viewport up
            topposition = playerposy-AW.toppad;
        } else {
            topposition = -VP.top;
        }
        if(topposition<toplimitmin) topposition = toplimitmin;
        if(topposition>toplimitmax) topposition = toplimitmax;

        $('#easelcan').css({'top':-topposition,'transition':'top '+transition}); // Set viewport Y position
    }
}