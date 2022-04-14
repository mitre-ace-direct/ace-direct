let inCall = false;

$(document).ready(() => {
    $('#optionsModal').modal('show');
});

function startCall(){
    document.getElementById("noCallPoster").style.display = "none";
    document.getElementById("inCallSection").style.display = "block";
}
