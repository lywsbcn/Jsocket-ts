

window.onload = function () {


    var add = document.getElementById("add");
    var remove = document.getElementById('remove');
    var removeAll = document.getElementById("removeAll");

    var action = {
        add: function () {
            Jsocket2.instance.addListener(1000, this, () => { })
        },
        remove: function () {
            Jsocket2.instance.removeListener(1000, this)
        },

        removeAll: function () {
            Jsocket2.instance.removeAllListener()
        }

        , allfunction: function () {

        }

    }

    document.body.addEventListener('click', function (e: any) {
        var target = e.target || e.srcElement;
        var at = target.getAttribute('at');

        action[at] && action[at]();
    })

}