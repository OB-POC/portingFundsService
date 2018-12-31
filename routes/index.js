var express = require('express');
var router = express.Router();
var jwt = require('jsonwebtoken');
var config = require('../data/config');
var serviceUrlConfig  = require("../data/serviceURL's");
var request = require('request');

router.post('/mergeAccounts', function(req, res, next) {
  var token = req.headers['x-access-token'];
  var postData = req.body;
  jwt.verify(token, config.secret , function(err, decodedObj){
    if (err) return res.status(500).json({ auth: false, message: 'Failed to authenticate token.' });
    var userName = decodedObj.username;
    request.get(serviceUrlConfig.dbUrl+'/'+userName+'-debit', function(err, response, body){
      if(err) return res.status(500).json({ message: 'Failed to load data'})
      // console.log(body, postData.transfers);
      var data = JSON.parse(body);
      postData.senders.map((obj)=>{
        var filteredSenderBank = data.banks.filter((bank)=>{
          return bank.bankName == obj.senderBank;
        })[0];
        var filteredReceiverBank = data.banks.filter((bank)=>{
          return bank.bankName == postData.receiver.receiverBank
        })[0];
        if(!filteredReceiverBank){
          filteredReceiverBank = {
            "bankName": "LBG",
            "bankId": "LLBBGG",
            "accounts": [
              {
                "accountType": "SB",
                "accountNumber": "XXXXXX XXXX2222",
                "accountTitle": "Easy Saver",
                "standingInst": 0,
                "balance": 0,
                "minBalance": 200,
                "interestRate": 0.5,
                "availableBalance": 0,
                "automatedSITransations": false,
                "standingInstructions": []
              }
            ]
          }
        }
        var restBankDetails = data.banks.filter((bank)=>{
          return bank.bankName != postData.receiver.receiverBank && bank.bankName != obj.senderBank;
        });
        filteredReceiverBank.accounts[0].balance = parseInt(filteredReceiverBank.accounts[0].balance) + parseInt(filteredSenderBank.accounts[0].balance);
        filteredReceiverBank.accounts[0].standingInstructions = [...filteredReceiverBank.accounts[0].standingInstructions, ...filteredSenderBank.accounts[0].standingInstructions];
        filteredReceiverBank.accounts[0].standingInst = filteredReceiverBank.accounts[0].standingInstructions.reduce((acc, val)=>acc+val.value,0);
        filteredSenderBank.accounts[0].availableBalance = filteredReceiverBank.accounts[0].balance - filteredReceiverBank.accounts[0].standingInstructions - filteredReceiverBank.accounts[0].standingInst;
        data.banks = [...restBankDetails, filteredReceiverBank];
      });
      request.patch({
        url: serviceUrlConfig.dbUrl+'/'+userName+'-debit',
        body: {
          'banks': data.banks
        },
        json: true
      }, function(err, response, body){
        if(err) return res.status(500).json({ message: 'Failed to patch data'})
        console.log(body);
        res.status(200).json(body);
      })
    })
  });
})

module.exports = router;
