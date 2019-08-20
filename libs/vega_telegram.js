
process.env.NTBA_FIX_319 = 1;
const uuidv4 = require('uuid/v4');
const EventEmitter = require('events');
const TelegramBot = require('node-telegram-bot-api');
const Agent = require('socks5-https-client/lib/Agent');
let moment = require( 'moment' );
class VegaTelegram extends EventEmitter
{
  constructor(token,status,proxy,debugMOD)
  {
    super();
    this._debugMOD = debugMOD;
    this._active = status;
    this._stack = [];
    if(status)
    {
      this._token = token;
      this._proxy = proxy;
      this._connect = {
          _status:false
      };
      this.reload();
            
      setInterval(()=>{
        if(this.employment)
        {
          this.checkStack();
        }
      },1000);
    }
  }
  get employment()
  {
    return  this._stack.length>0;
  }
  get active()
  {
    return this._active;
  }
  validProxy()
  {
    return this._proxy.host && this._proxy.port;
  }
  reload()
  {
    let polling = {polling:false};
    if( this._proxy.status === true )
    {
        polling.polling = true;
        if ( this.validProxy() )
        {
            let host = this._proxy.host;
            let port = this._proxy.port;
            let username = this._proxy.login;
            let password = this._proxy.password;
            polling.request = {
            agentClass: Agent,
            agentOptions: {
                    socksHost: host,
                    socksPort: port
                }
            }
            if( username && password ) 
            {
                polling.request.agentOptions.socksUsername = username;
                polling.request.agentOptions.socksPassword = password;
            }
        } 
    }
    this._connect = new TelegramBot(token, polling);
    this._connect._status = true;
    this._connect.on('polling_error',this._error);
    this._connect._self = this;
  }
  _error(err)
  {
    console.log(moment().format('LLL')+': '+'[Telegram] Error '+err.code);
    this._connect._status = false;  
  }
  checkStackEmptiness()
  {
    if(!this.employment) this.emit('free');
  }
  pushMessage(message,chatId,time)
  {
    this._stack.push({message:message,chatId:chatId,uuid:uuidv4(),status:false,firstTime:time});
  }
  checkStack()
  {
    let _self = this;
    if(this._connect._status)
    {
        for(let i = 0; i < this._stack.length; i++)
        {
            var item = this._stack[i];
            if(!item.status)
            {
                item.status = true;
                let data = {
                chatId:item.chatId,
                mes:item.message
                };
                _self.sendMessage(data,item.uuid)
                .then((res)=>{
                    if(res.status)
                    {
                        for(let j = 0 ; j < _self._stack.length; j++)
                        {
                            if(_self._stack[j].uuid === res.uuid)
                            {
                                console.log(moment().format('LLL')+': '+'[Telegram] Success to send voice message '+_self._stack[j].chatId+'( '+res.chat.username+' )');
                                _self._stack.splice(j,1);
                                _self.checkStackEmptiness();
                            }
                        }
                    }
                    else
                    {
                        for(var j = 0 ; j < _self._stack.length;j++)
                        {
                            if(_self._stack[j].uuid === res.uuid)
                            {
                                _self._stack[j].status = false;
                                let tmp = _self._stack[j];
                                _self._stack.splice(j,1);
                                let firstTime = tmp.firstTime;
                                let currentTime = new Date().getTime();
                                let timePassed = firstTime?(currentTime-firstTime):0;
                                let lifeTime = timePassed<86400000;
                                if(lifeTime)
                                {
                                    _self.pushMessage(tmp.message,tmp.chatId,tmp.firstTime);
                                }
                                console.log(moment().format('LLL')+': '+'[Telegram] Failed to send  voice message '+tmp.chatId+'. Error '+ res.err);
                                _self.checkStackEmptiness();
                            }
                        }
                    }
                })
                .catch((e)=>{
                    console.log(moment().format('LLL')+': '+'[Telegram] Failed to send  http message. Error 1');
                    console.log(moment().format('LLL')+': ',e);
                });
                break;
            }
        }
    }
  }
  sendMessage(data,uuid)
  {
    let _self = this;
    return new Promise((resolve, reject)=>{
      try
      {
        _self._connect.sendMessage(data.chatId, data.message)
        .then((res)=>{
            resolve({status:true,uuid:uuid,username:res.chat.username});
        })
        .catch((err)=>{
            resolve({status:false,uuid:uuid,err:err.code});
        });
      }
      catch (e)
      {
        reject(e);
      }
    });
  }
}
module.exports = VegaTelegram;
