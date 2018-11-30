var db = require('./db_servers.json');

// para realizar una persistencia periodica
var cron = require('node-cron');

// var promise = require('promise');

var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/";

var AdminBackups = function () {
    // dataServer(array) deberia tener la info de cada compra realizada (estado, datosCompra, history)
    this.saveData = function(dataServerDB){
        // cada minuto realizamos el backup
        cron.schedule('* * * * *', () => {
          if(dataServerDB.length > 0){
            MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
              if (err) throw err;
              var dataBackup = getDataBackup(dataServerDB);
              var nameServer = dataBackup.name_server;
              var nameDb = getNameDb(nameServer);
              var dbo = db.db(nameDb);
              // aca se deberia hacer toda la persistencia
              dbo.collection("backups").insertOne(dataBackup, function(err, res) {
                  if (err) throw err;
                  console.log("[AdmBack]: Backup realizado con exito: "+nameDb);
                  db.close();
              });
            });
          }
          else{
            console.log("[AdmBack]: No hay datos para persistir ");
          }
        });

    }

    this.getDataDbPromise = function(nameServer){
      return new Promise(function(resolve, reject) {
        // var dataUltimoBackup = null;
        MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
          if (err) throw err;
          var nameDb = getNameDb(nameServer);
          var dbo = db.db(nameDb);
          // se recuperan los datos de la db
          // dataUltimoBackup = dbo.collection("backups").find({}).toArray(function(err, datosBackupDB) {
          dbo.collection("backups").find({}).toArray(function(err, datosBackupDB) {
              if (err) throw reject(err);
              // devolvemos solo el ultimo backup realizado
              resolve(datosBackupDB.pop());
              db.close();
          });
        });
      });
    }
}

module.exports = AdminBackups;

// ###############################################################
// ###################### FUNCIONES PRIVADAS #####################

function getNameDb(nameServer){
    var name_db = null;
  
    switch (nameServer) {
      case 'COMPRAS':
        name_db = db.compras;
        break;
      case 'PUBLICACIONES':
        name_db = db.publicaciones;
        break;
      case 'WEB':
        name_db = db.web;
        break;
      case 'INFRACCIONES':
        name_db = db.infracciones;
        break;
      case 'PAGOS':
        name_db = db.pagos;
        break;
      case 'ENVIOS':
        name_db = db.envios;
        break;
      default:
        console.log("Servidor desconocido");
        break;
    }
  
    return name_db;
  }

  // recupera los datos de los objetos actuales activos
  function getDataBackup(objectJssmDB){
    var dataBackup = {
      name_server: null,
      date: null,
      data_jssm: []
    }

    var objectBackup = {
      current_status: null,
      data_compra: null,
      history: null
    }

    var existData = false;

    // guardams los datos de cada objeto
    for (let i = 0; i < objectJssmDB.length; i++) {
      existData = true;
      const dataJssm = objectJssmDB[i];
      objectBackup.current_status = dataJssm.state;
      objectBackup.data_compra = dataJssm.compra;
      objectBackup.history = dataJssm.history;
      // agregamos el elemento a la lista de objetos
      dataBackup.data_jssm.push(objectBackup);
    }

    if(existData){
      dataBackup.name_server = objectJssmDB[0].nombreSimulador;
      var currentDate = new Date(Date.now()).toLocaleString();
      dataBackup.date = currentDate;
    }

    return dataBackup;
  }