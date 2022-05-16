// node version: 16.13.2

const fs = require('fs');
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();
const PNF = require('google-libphonenumber').PhoneNumberFormat;

const rgx = /\".+,.+\"/;
const regex_email = /^[a-z0-9.]+@[a-z0-9]+\.[a-z]+(\.[a-z]+)?$/g;
const regex_turma = /([a-zA-Z]+ +\d+)|(Noturno)|(Diurno)/gm;

//auxiliar function to return array of addresses with correct tags and types
function GetAddresses (address, type, tags){
  let addresses = [];
  let phone = address.replace(/[^0-9]/g, '');
  let valid = false;
  try{
    phone = phoneUtil.parse(phone, 'BR');
    phone = phoneUtil.format(phone, PNF.E164).toString();
    phone = phone.slice(1,phone.length)
    valid = phone.length === 13;
  }catch(e){
    valid = false;
  }

  if(valid === false){
    address = address.split(/(\/)|\,| /g);
    address.forEach((v => {
      if(v){
        v = v.match(regex_email);
        if(v){
          addresses.push({type, tags, address:v[0]});
        }
      }
    }))
  }else{
    addresses.push({type, tags, address:phone});
  }

  return addresses;
}


//auxiliar function to verify if address already existis within array
function AddressExists(arr, address){
  let exists = false;
  arr.forEach(v => {
    if(v.address === address){
      exists = true;
    }
  })
  return exists;
}


//auxiliar function to return the merge between two arrays without duplicating same elements
function AllUnique (arr1, arr2){
  let result = arr1
  arr2.forEach(val => {
    if(result.indexOf(val) === -1){
      result.push(val);
    }
  })
  return result;
}


//main fn
async function main (file, output) {
  let data = "";
  let object = [];
  let order = [];

  //read file async
  await new Promise((resolve, reject) => {
    fs.readFile(file, {encoding:'utf-8'}, (err, dat) => {
      if(err){
        reject(err);
      }else{
        resolve(dat);
      }
    })
  }).then(res => {
    data = res;
  });
  
  //split lines
  data = data.split('\n');

  //split by comma
  data.forEach((value, index) => {
    //removes ',' between '"'
    if(index > 0){
      let match = value.match(rgx);
      while(match){
        value = value.replace(match[0], match[0].replace(/\,/g, '\n').replace(/\"/g, ''));
        match = value.match(rgx);
      }
    }

    //splits by ','
    data[index] = value.split(/\,/);
  });

  //creates a object for each index in data except first(header)
  for(let i = 1; i < data.length; i++){
    //if its a valid line, creates a new object and fills with info using format data[0][j](column) : data[i>0][j](value)
    if(data[i].length >= 4){
      object.push({});
      for(let j = 0; j < data[i].length; j++){
        data[0][j] = data[0][j].replace(/\"/g, '');
        data[0][j] = (data[0][j] == 'group') ? 'groups' : data[0][j];
        if(object[i-1][data[0][j]]){
          object[i-1][data[0][j]] += ' '+data[i][j];
        }else{
          object[i-1][data[0][j]] = data[i][j];
        }
      }
    }
  }

  let jsonObj = {};

  //merges same EID entities and converts addresses and groups to correct format
  object.forEach(line => {
    let leid = line.eid;
    let keys = Object.keys(line);

    if(!jsonObj[leid]){
      jsonObj[leid] = {
        fullname:'',
        eid:'',
        groups:[],
        addresses:[],
        invisible:false,
        see_all:false
      };
    }

    keys.forEach(k => {
      k = k.split(' ');

      if(!k[1]){
        k = k[0];
        let tumaMatch = line[k].match(regex_turma);

        if(tumaMatch === null){
          if(k !== 'groups'){
            jsonObj[leid][k] = (k === 'invisible' || k === 'see_all') ? (line[k] === 'yes' || line[k] === '1') : line[k];
          }
        }else{
          line[k] = tumaMatch;
          jsonObj[leid][k] = AllUnique(jsonObj[leid][k], tumaMatch);
        }

      }else{
        let type = k[0];
        let tags = [];

        k.forEach((va, ind) => {
          if(ind>0){
            k[0] += ' '+va
            tags.push(va);
          }
        })

        let address = GetAddresses(line[k[0]], type, tags);
        address.forEach(a => {
          if(!AddressExists(jsonObj[leid]['addresses'], a.address)){
            jsonObj[leid]['addresses'].push(a);
          }
        })

      }
    })
  });

  let ordered = [];
  let eids = [];

  for(let i = 1; i < data.length; i++){
    if(eids.indexOf(data[i][1]) === -1 && data[i].length >= 4){
      eids.push(data[i][1]);
      ordered.push(jsonObj[data[i][1]]);
    }
  }

  fs.writeFile(output, JSON.stringify(ordered, ' ', ' '), () => {});
}

//main call
main('input.csv', 'output.json');