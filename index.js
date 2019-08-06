const app = require('./libs/app.js');
const Config = require('./libs/config.js');
const fs = require('fs');
const ini = require('ini');
let moment = require( 'moment' );
let config = new Config();
let myConfig = {};
let path = './config.ini';
if(!fs.existsSync(path))
{
  console.error( moment().format('LLL') + ':'+' Error accessing config.ini file');
  process.exit(0);
}
else
{
  try
  {
    myConfig = ini.parse(fs.readFileSync(path, 'utf-8'));
  }
  catch (e)
  {
    console.error(moment().format('LLL') + ':'+' Config.ini file is not in the correct format, check that the data is correctly populated',e);
    process.exit(0);
  }
  finally
  {
    let resultSetSettings = config.setFromConfig(myConfig);
    if(!resultSetSettings)
    {
      console.error(moment().format('LLL') + ':'+' Some config.ini parameters were not correctly populated!');
      process.exit(0);
    }
    else
    {
      app.run(config);
    }
  }
}
