const log = require('debug-level')('login-info');
const chalk = require('chalk');
const figlet = require('figlet');
const ora = require('ora');
const request = require('request-promise-native');
const si = require('systeminformation');
const util = require('util');

log.info('app starting');
log.debug('gathering config');
const yargs = require('yargs');
var cfg = {}
require('rc')('login-info',cfg);
log.debug('config: %o',cfg)

const Functions = {
    getFSInfo: function(ctx){
      return si.fsSize()
      .then(data => {
        ctx.fsInfo = data;
      })
    },
    getCPU: function(ctx){
      return si.cpu()
      .then(data => {
        ctx.cpu = data;
      })
    },
    getOS: function(ctx){
      return si.osInfo()
      .then(data => {
        ctx.os = data;
      })
    },
    getMem: function(ctx){
      return si.mem()
      .then(data => {
        ctx.mem = data
      })
    },
    getLoad: function(ctx){
        return si.currentLoad()
        .then(data => {
            ctx.load = data
        })
    },
    getInternalIP: function(ctx){
    
    },
    getExternalIP: function(ctx){
        return request('http://checkip.amazonaws.com/')
        .then(resp => {
            ctx.externalip = resp.substr(0,resp.length-1)
        })
    },  
    getNetworkInterfaces: function(ctx){
        return si.networkInterfaces()
        .then(data => {
          ctx.networkInterfaces = data;
        })
    },
    getDefaultNetInferface: function(ctx){
        return si.networkInterfaceDefault()
        .then(data => {
          ctx.defaultNetInterface = data
        })
    },
    getNetStats: function(ctx){
        return si.networkStats()
        .then(data => {
          ctx.networkStats = data;
        })
    },
    getProcesses: function(ctx){
        return si.processes()
        .then(data => {
          ctx.processes = data
        })
    }
}        

var argv = yargs
    .config(cfg)
    .option('fsinfo',{
        alias: 'f',
        describe: 'show file system info',
        type: 'boolean'
    })
    .option('name',{
        describe: 'name to show as figlet',
        type: 'string'
    })
    .option('psinfo',{
        alias: 'p',
        describe: 'show top process info',
        type: 'boolean'
    })
    .help()
    .argv


const name = argv.name || 'SysInfo'
console.log(chalk.blue.bold(figlet.textSync(name,'Standard')));
const spinner = ora('Gathering information...').start();
const sdat = {};
const promises = [
  Functions.getCPU(sdat),
  Functions.getOS(sdat),
  Functions.getMem(sdat),
  Functions.getLoad(sdat),
  Functions.getExternalIP(sdat),
  Functions.getNetworkInterfaces(sdat),
  Functions.getDefaultNetInferface(sdat),
  Functions.getNetStats(sdat)
];
if (argv.fsinfo) promises.push(Functions.getFSInfo(sdat))
if (argv.psinfo) promises.push(Functions.getProcesses(sdat));
var d1 = new Date();
Promise.all(promises)
.then(_ => {
    var d2 = new Date();
    spinner.stop();
    log.debug('done');
    console.log(util.format('OS: %s %s ver %s (%s) arch %s kernel %s',
    sdat.os.platform,sdat.os.distro,chalk.bold.red(sdat.os.release),
    chalk.green.bold(sdat.os.codename),sdat.os.arch,sdat.os.kernel
  ))
  var iface = null;
  sdat.networkInterfaces.forEach(iface => {
    if (iface.ifaceName == sdat.defaultNetInterface){
      sdat.internalip = iface.ip4
    }
  })
  console.log(util.format('Network: dev %s external %s internal %s',
    chalk.bold(sdat.defaultNetInterface),chalk.bold.red(sdat.externalip),
    chalk.bold.green(sdat.internalip)
  ));
  console.log(util.format('CPU: %d core(s) speed %s GHz, load %s%%',
    sdat.cpu.cores,chalk.bold.green(sdat.cpu.speed),
    chalk.bold.green(sdat.load.avgload)
  ))
  console.log(util.format('Memory: Total %sM Free %sM (%s%%)',
    chalk.bold((sdat.mem.total/1000/1000).toFixed(2)),
    chalk.bold((sdat.mem.free/1000/1000).toFixed(2)),
    chalk.bold.green((sdat.mem.free/sdat.mem.total * 100.0).toFixed(2))
  ))
  if (argv.fsinfo){
    log.debug(sdat.fsInfo);
    console.log(util.format('\nFile system(s):'))
    console.log(util.format('%s %s %s','name'.padEnd(20,' '),'mount'.padEnd(30,' '),'usage'.padStart(6)))
    sdat.fsInfo.forEach(fs => {
      var amt = fs.use.toFixed(0)
      var amtClr = chalk.bold.green
      if (amt>80.0) amtClr = chalk.bold.red
      console.log(util.format('%s %s %s',fs.fs.padEnd(20,' '),fs.mount.padEnd(30,' '),
        amtClr(fs.use.toFixed(0).toString().padStart(6))
      ))
    })
  }
  if (argv.psinfo){
    //console.log(sdat.processes);
    sdat.processes.list.sort((a,b) => b.pmem - a.pmem);
    console.log('\nProcesses: top 5 memory users');
    console.log(util.format('%s %s %s %s %s'),'pid'.padEnd(10,' '),'parent'.padEnd(10,' '),'path'.padEnd(25,' '),
      'name'.padEnd(25,' '),'mem %'.padEnd(10, ' '))
    for (var i=0; i<5; i++){
      var prc = sdat.processes.list[i];
      if (prc.path == '') prc.path = '(none)'
      console.log(util.format('%s %s %s %s %s'),
        prc.pid.toString().padEnd(10,' '),
        prc.parentPid.toString().padEnd(10,' '),
        prc.path.substr(0,23).padEnd(25,' '),
        prc.name.substr(0,23).padEnd(25,' '),
        chalk.bold.green(prc.pmem.toString().padEnd(10,' '))
      )
    }
    sdat.processes.list.sort((a,b) => b.pcpu - a.pcpu);
    console.log('\nProcesses: top 5 cpu users');
    console.log(util.format('%s %s %s %s %s'),'pid'.padEnd(10,' '),'parent'.padEnd(10,' '),'path'.padEnd(25,' '),
      'name'.padEnd(25,' '),'cpu %'.padEnd(10, ' '))
    for (var i=0; i<5; i++){
      var prc = sdat.processes.list[i];
      if (prc.path == '') prc.path = '(none)'
      console.log(util.format('%s %s %s %s %s'),
        prc.pid.toString().padEnd(10,' '),
        prc.parentPid.toString().padEnd(10,' '),
        prc.path.substr(0,23).padEnd(25,' '),
        prc.name.substr(0,23).padEnd(25,' '),
        chalk.bold.green(prc.pcpu.toFixed(2).toString().padEnd(10,' '))
      )
    }
    }
})