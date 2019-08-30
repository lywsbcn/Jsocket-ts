```
Jsocket.instance.url='ws://127.0.0.1:8080';
Jsocket.instance.open();

Jsocket.instance.addConnect(this, () => {
            this.handshakeRequest();
        })
        
Jsocket.instance.send(this, req, (d, f, m) => {
            if (f == Flag.success) {
                this.initView();
            } else {
                Msg.alert.text(m, function () {
                    location.href = "/";
                })
            }

        })
```
