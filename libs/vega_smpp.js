const SMPP = require('smpp');
const uuidv4 = require('uuid/v4');
const EventEmitter = require('events');
class VegaSMPP extends EventEmitter
{
  constructor(address,system,info,status,debugMOD)
  {
    super();
    this._debugMOD = debugMOD;
    this._active = status;
    this._stack = [];
    if(status)
    {
      this._address = address;
      this._system = system;
      this._info = {};
      this._connect = {
        _status:false
      };
      if(info)
      {
        this._info = info;
      }
      this.reload();
      setInterval(()=>{
        if(this._connect._status)
        {
        //  console.log(this._connect._status);
        }
        else
        {
        //  console.log(this._connect._status);
          var currentDate = new Date().getTime();
          var validLastTimeReconnect = this._connect._last_time_reconnect!==undefined&&typeof this._connect._last_time_reconnect==='number';
          var lastDate = validLastTimeReconnect?this._connect._last_time_reconnect:currentDate;
          var time = currentDate-lastDate;
          if(time>20000&&!this._connect._status)
          {
            this.reload();
          }
          else
          {

          }
        }
      }, 5000);
      setInterval(()=>{
        if(this.employment)
        {
          this.checkStackSMS();
        }
        if(this._connect._status)
        {
          if(this._connect._counter===undefined)
          {
            this._connect._counter=0;
          }
          else
          {
            this._connect._counter+=100;
          }
          if(this._connect._counter>=30000)
          {
            this._connect._counter=0;
            this._connect.enquire_link();
          }
        }
      },100);
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
  pushSMS(message,telephone,time)
  {
    console.log('pushSMS '+telephone+' '+message);
    this._stack.push({message:message,telephone:telephone,uuid:uuidv4(),status:false,firstTime:time});
  }
  checkStackSMS()
  {
    let _self = this;
    console.log(this._connect._status);
    if(this._connect._status)
    {
      for(let i = 0; i < this._stack.length; i++)
      {
        var item = this._stack[i];
        if(!item.status)
        {
          item.status = true;
          this.sendSMS(item.telephone,item.message,item.uuid)
          .then((res)=>{
           if(res.status)
           {

             for(let j = 0 ; j < _self._stack.length; j++)
             {
               if(_self._stack[j].uuid === res.uuid)
               {
                 console.log('Success to send sms message '+_self._stack[j].telephone);
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
                 {
                   _self.pushSMS(tmp.message,tmp.telephone,tmp.firstTime);
                 }
                 _self.checkStackEmptiness();
                 console.log('failed to send  sms message '+tmp.telephone);
               }
             }

           }
         })
         .catch((e)=>{
           item.status = false;
           console.log('failed to send  sms message. Error 1');
           console.log(e);
         });
         break;
        }
      }
    }
  }
  checkStackEmptiness()
  {
    if(!this.employment) this.emit('free');
  }
  reload()
  {
    this._connect = new SMPP.Session(this._address);
    this._connect._system = this._system;
    this._connect._last_time_reconnect = new Date().getTime();
    this._connect.on('close',this._close);
    this._connect.on('error',this._error);
    this._connect.on('pdu',this._pdu);
    this._connect.on('connect',this._connectSMPP);
    this._connect._self = this;
  }
  _connectSMPP()
  {
    var _self = this;
    this.bind_transceiver(this._system, function(pdu) {
      console.log(pdu.command_status);
      if (pdu.command_status == 0 || pdu.command_status == 5)
      {
          _self._status = true;
          console.log(_self._status,'_self');
          console.log('Successful connection on SMPP');
      }
      else
      {
        _self._status = false;
        console.log('Not successful connection on SMPP');
      }
    });
    this._self.checkStackSMS();
  }
  _pdu(pdu)
  {
    if (pdu.command == 'deliver_sm')
    {
      var fromNumber = pdu.source_addr.toString();
      var toNumber = pdu.destination_addr.toString();
      var text = '';
      if (pdu.short_message && pdu.short_message.message)
      {
        text = pdu.short_message.message;
      }
      console.log('SMS ' + from + ' -> ' + to + ': ' + text);
      // Reply to SMSC that we received and processed the SMS
      this._connect.deliver_sm_resp({ sequence_number: pdu.sequence_number });
    }
  }
  _close()
  {
    console.log('smpp disconnected');
    this._status = false;
  }
  _error(error)
  {
    console.log('smpp error', error);
    this._status = false;
  }
  lookupPDUStatusKey(status)
  {
    try {
      for (var k in SMPP.errors)
      {
        if (SMPP.errors[k] == pduCommandStatus) return k;
      }
    } catch (e) {
      return undefined;
    } finally {

    }

  }
  sendSMS(to, text, uuid)
  {
    let _self = this;
    return new Promise((resolve, reject)=>{
      try
      {
        to   = to.toString();
        let mess = {
          //  source_addr: _self._info.sender,
            destination_addr: to,
            short_message: text,
            //source_addr_ton: _self._info.source_addr_ton
        };
        for(let key in _self._info)
        {
          mess[key] = _self._info[key];
        }
        _self._connect.submit_sm(mess, function(pdu)
        {
            if (pdu.command_status == 0)
            {
                resolve({status:true,uuid:uuid});
            }
            else
            {
              console.log(pdu.command_status);
              resolve({status:false,uuid:uuid});
            }
        });
      }
      catch (e)
      {
        reject(e);
      }
    });
  }
}
module.exports = VegaSMPP;
