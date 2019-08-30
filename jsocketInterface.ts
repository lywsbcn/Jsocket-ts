
/**
 * websocket 收到报文后封装的一个数据模型
 * 在Jsocket 类中的数据层的基本数据结构
 * */
interface JsmInterface {
    /**
     * 每个请求自动累计一个值,用来判断是否为该请求
     * 注意:这个需要服务端的支持
     * */
    what: number;

    /**
     * websocket 收到的数据
     * 经过 JSON.parse() 处理
     * */
    original: any;
}

/**
 * Jsocket 中回调数据结构
 * */
interface JscInterface {
    /**
     * 该回调所属的对象指针
     * */
    target: any;

    /**
     * 默认情况下,回调已经调用将会被删除
     * 如果不想被删除,always 设置为true
     * */
    always: boolean;

    /**
     * 请求回调
     * 当发起请求,服务端回复数据时
     * 将会调用该函数
     * */
    block: (response: any, flag?: number, msg?: string, jsocket?: JsocketInterface) => void;


    isLoading?: boolean;
}

/**
 * 
 * */
interface JsEventCallback {
    /**
     * 该回调所属的对象指针
     * */
    target: any;

    /**
     * 默认情况下,回调已经调用将会被删除
     * 如果不想被删除,always 设置为true
     * */
    always: boolean;

    /**
     * 请求回调
     * 当发起请求,服务端回复数据时
     * 将会调用该函数
     * */
    block: (jsocket?: JsocketInterface) => void;

}


/**
 * Jsocket 重连接口定义
 * */
interface JsconnInterface {

    /**是否为用户断开连接 */
    userClose: boolean;

    /**
     * 是否开启重连
     * 默认为true;
     * */
    isReConn: boolean;

    /**
     * 重连模式
     * 0.固定定时模式,每隔reConnInterval秒重连
     * 1.累加定时模式,重连的时间是上一次重连时间的2倍
     *   当重连时间 大于 reConnIntervalMax 时,
     *   重连时间重新从 reConnIntervalMin 开始
     *   
     *   默认为 0;
     * */
    pattern: number;

    /**
     * 设置 重连模式
     * @param type
     */
    setPattern(type: number): void;

    /**
     * 重连最大的尝试次数
     * 如果次数大于该值还未连接成功,则不再重连
     * 当 reConnNumber==0 时,表示无限次数重连
     * 
     * 默认为 0;
     * */
    number: number;

    /**
     * 当前的重连次数
     * 每次开始重连计数+1
     * 注意:当连接成功,值重置为 0
     * */
    currNumber: number;

    /**
     * 重连间隔时间
     * 当reConnPattern==1时,起始值将会被 reConnIntervalMin替换
     * 默认为 10000;
     * */
    interval: number;

    /**
     * 重连最长间隔时间
     * 注意不可以小于 reConnIntervalMin;
     * 默认 60;
     * */
    intervalMax: number;

    /**
     * 设置 重连最长间隔时间
     * @param num
     */
    setIntervalMax(num: number): void;

    /**
     * 当reConnPattern==1时,重连间隔时间的起始时间
     * */
    intervalMin: number;

    /**
     * 设置 重连最短时间
     * @param num
     */
    setIntervalMix(num: number):void;

    /**
     * 重连定时器
     * */
    timer: number;
}

/**
 * Jsocket 数据源定义
 * */
interface JsDataSourceInterface {

    /**
     * 心跳间隔时间
     * */
    hbInterval: number;

    /**
     * 心跳定时器
     * */
    hbTimer: number;

    /**
     * 心跳请求包
     * */
    hbPacket: () => object;

    /**
     * 设置心跳请求包
     * 并启动心跳
     * @param packet 心跳请求包
     */
    setHbPacket(packet: () => object): void;


    /**
     * 握手请求包
     * */
    hsPacket: () => object;
    
}

/**
 * Jsocket 控制台,日志接口定义
 * */
interface JslogInterface {

    /**
     * 服务器标签
     * 日志输出时,在前面显示
     * */
    TAG: string;

    /**
     * 是否 显示日志
     * */
    showLog: boolean

    /**
     * 如果showLog == true
     * 请求时 这些action 值不输出
     * */
    requestFilter: Array<string | number>

    /**
     * 如果showLog == true
     * 回复时, 这些action 值不输出
     * */
    responseFilter: Array<string | number>

    addRequestFilter(...a);

    addResponseFilter(...a);

    addFilter(...a);

}

/**
 * Jsocket 事件模型定义
 * */
interface JsEventMInterface {


    /**
     * websocket 连接成功回调
     * */
    Connected: Array<JsEventCallback>;

    /**
     * 添加或者移除 连接成功的回调
     * 当 callback ==null 或者未定义时,执行移除操作
     * @param target    回调所属对象
     * @param callback  回调函数
     */
    ConnectAor(target: any, callback?: (jsocket?: JsocketInterface) => void): void;

    /**
     * websocket 握手成功回调
     * */
    Handshaked: Array<JscInterface>;

    /**
     * 添加或者移除 握手成功的回调
     * 当 callback ==null 或者未定义时,执行移除操作
     * @param target    回调所属对象
     * @param callback  回调函数
     * @param always    调用后是否不移除 默认:true 表示不移除
     */
    HandshakeAor(target: any, callback?: (response: any, flag?: number, msg?: string, jsocket?: JsocketInterface) => void, always?: boolean): void;

    /**
     * websocket 连接错误回调
     * */
    Errored: Array<JsEventCallback>;

    /**
     * 添加或者移除 连接错误的回调
     * 当 callback ==null 或者未定义时,执行移除操作
     * @param target    回调所属对象
     * @param callback  回调函数
     */
    ErrorAor(target: any, callback?: (jsocket?: JsocketInterface) => void): void;

    /**
     * websocket 连接关闭回调
     * */
    Closed: Array<JsEventCallback>

    /**
     * 添加或者移除 连接关闭的回调
     * 当 callback ==null 或者未定义时,执行移除操作
     * @param target    回调所属对象
     * @param callback  回调函数
     */
    CloseAor(target: any, callback?: (jsocket?: JsocketInterface) => void): void;


    /**
     * 分组 的 key
     * eventMessaged
     * eventListener
     * 
     * 默认值为 action
     * */
    KGroup: string ;

    /**
     * 回调参数中flag 对应的key
     * 默认 flag
     * */
    KFlag: string;

    /**
     * 回调参数中msg 对应的key
     * 默认 msg
     * */
    KMsg: string;

    /**
     * what 参数名称
     * 默认 what
     * */
    KWhat: string;

    KAssign: string;
    

    /**
     * websocket 收到消息回调
     * 该回调不会主动移除
     * */
    Listener: { [key: string ]: Array<JscInterface> }

    /**
     * 添加或者移除 收到消息回调
     * 该回调不会主动移除
     * 当 callback ==null 或者未定义时,执行移除操作
     * @param target    回调所属对象
     * @param callback  回调函数
     */
    //MessageAor(what: number,action: string | number, target: any, callback?: (response: any, flag?: number, msg?: string) => void): void;

    /**
     * 添加或者移除 收到消息回调
     * 该回调会主动移除
     * */
    Callback: { [key: string]: Array<JscInterface> }
    Assign: { [key: string]: JscInterface } 

    AssignAppend(name, target, callback, isLoading?: boolean);
    AssignRemove(name)

    /**
     * 添加或者移除 收到消息回调
     * 该回调会主动移除
     * 当 callback ==null 或者未定义时,执行移除操作
     * @param target    回调所属对象
     * @param callback  回调函数
     * @param always    always==true,会调用eventMessageAor()
     */
    ListenerAor(action: string | number, target: any, callback?: (response: any, flag?: number, msg?: string, jsocket?: JsocketInterface) => void, always?: boolean, isLoading?: boolean): void;

    /**移除所有回调事件,不包括Event */
    removeAllListener(taget?: any): void

    /**移除所有监听事件 */
    removeAllEvent(target?: any): void

    /**移除所有回调事件,所有监听事件 */
    removeAll(target?: any): void
}


interface JsocketInterface {

    /**
     * websocket 对象
     * */
    ws: WebSocket

    /**
     * websocket 连接地址
     * */
    wsUrl: string;

    /**
     * 重连配置
     * */
    conn: JsconnInterface

    /**
     * 日志配置
     * */
    log: JslogInterface

    /**
     * 事件管理
     * */
    event: JsEventMInterface

    /**
     * 设置连接地址
     * @param host  域名
     * @param port  端口
     * @param upgroup 协议
     */
    setWsUrl(host: string, port?: number, upgroup?: boolean): void;

    /**
     * 打开websocket 连接
     * @param url
     */
    open(url?: string): void;

    /**
     * 关闭websocket连接
     * */
    close(userClose?: boolean): void;

    /**
     * 发送请求
     * @param taget ==null 表示不添加回调
     * @param param 请求的参数
     * @param callback  回调
     * @param always    回调完成是否删除,默认false表示删除
     * @param isLoading 是否显示loading 默认 true
     */
    send(taget: any, param: object, callback?: (response: any, flag?: number, msg?: string, jsocket?: JsocketInterface) => void, always?: boolean, isLoading?: boolean): void;


    record: {
        filter: Array<any>,
        request: any,
        response: any,
    }

    addRecordFilter(action: string | number);
    addRecordRequst(action, data);
    addRecordResponse(action, data);
}