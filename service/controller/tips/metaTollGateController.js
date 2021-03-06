import ConnectMetaOracle from '../../oracle/connectMetaOracle';
import connectDynamicOracle from '../../oracle/connectDynamicOracle';
import connectRenderObj from '../../oracle/connectRenderObj';
import connetSelfObje from '../../oracle/connectOracle';
import logger from '../../config/logs';
import {changeResult} from '../../Util';

class TollGate {
  constructor(req, res, next) {
    this.req = req;
    this.res = res;
    this.next = next;
    this.table = 'SC_TOLL_TOLLGATEFEE';
    this.db = new ConnectMetaOracle();
    this.selfDB = new connetSelfObje();
    this.originDB = connectRenderObj;
    // 与收费站有关的表;
    this.tollRelateTable = ['SC_TOLL_CAR','SC_TOLL_TRUCK','SC_TOLL_LOAD','SC_TOLL_LOAD_GD','SC_TOLL_OVERLOAD','SC_TOLL_TOLLGATEFEE','SC_TOLL_GROUP'];
  }

  /**
   * 根据groupId查询收费站信息;
   */
  async getTollGate() {
    const param = this.req.query;
    const pid = param.pid;
    this.table = param.table;
    if (param.workFlag == 'dynamic') {
      this.db = new connectDynamicOracle();
    }
    const primaryKey = this.table === 'SC_TOLL_TOLLGATEFEE' ? 'TOLL_PID' : this.table === 'SC_TOLL_LIMIT' ? 'SYSTEM_ID' : this.table === 'SC_TOLL_RDLINK_BT' ? 'NAME_BT_ID' : 'GROUP_ID';
    let sql = "SELECT * FROM " + this.table + " WHERE " + primaryKey + " = '" + pid + "'";
    const result = await this.db.executeSql(sql);
    const resultData = changeResult(result);
    this.res.send({
      errorCode: 0,
      data: resultData
    });
  }

  /**
   * 
   */
  async getHolidayMax() {
    const param = this.req.query;
    this.table = param.table;
    const queryNum = param.adminCode.substr(0,2);
    this.db = new connectDynamicOracle();
    let sql = "SELECT max(ID) as maxNum from "+this.table+" where ID LIKE '"+queryNum+"%'";
    const result = await this.db.executeSql(sql);
    const resultData = changeResult(result);
    this.res.send({
      errorCode: 0,
      data: resultData
    });
  }

  /**
   * 根据groupId查询收费站信息;
   */
  async getTollName() {
    const param = this.req.query;
    const pids = param.pid;
    this.table = param.table;
    let sql = `SELECT b.type, b.pid, a.name FROM ${this.table} a, RD_TOLLGATE b WHERE a.pid=b.pid AND a.pid IN (${pids.join(',')}) AND a.lang_code='CHI'`;
    const result = await this.originDB.executeSql2(sql);
    const resultData = changeResult(result);
    this.res.send({
      errorCode: 0,
      data: resultData
    });
  }

  

  /**
   * 获得桥梁隧道名称;
   */
  async getBtName() {
    const param = this.req.query;
    const nameString = param.bridgeName;
    this.table = param.table;
    // 动态库中没有rd_name表;
    // if (param.workFlag == 'dynamic') {
    //   this.db = new connectDynamicOracle();
    // }
    let dbSql = `create database link gdb_Links
    connect to fm_gdb_trunk identified by fm_gdb_trunk
    using '(DESCRIPTION = (ADDRESS_LIST = (ADDRESS = (PROTOCOL = TCP)(HOST = 192.168.3.227)(PORT = 1521 )))(CONNECT_DATA = (SERVICE_NAME = orcl )))'`;
    let dblinkconn = await this.db.executeSql(dbSql);
    let querySql = `SELECT DISTINCT n.NAME_GROUPID,n.NAME FROM rd_link_name@gdb_Links l, rd_name n WHERE l.name_groupId = n.name_groupId AND n. NAME LIKE '%${nameString}%' AND n.lang_code='CHI' AND l.name_type IN (4, 5)`;
    let result = await this.db.executeSql(querySql,'gdb_Links');
    await this.db.executeSql(`drop database link gdb_Links`);
    const resultData = changeResult(result);
    this.res.send({
      errorCode: 0,
      data: resultData
    });
  }

  // 获得批量插入index表的sql语句;
  _getInsertStringSql (pids, flag) {
    let sql = `INSERT ALL INTO SC_TOLL_INDEX `;
    pids.forEach((item, index) => {
      let insertValue = flag == 'static' ? `${item},${this.adminCode},0,Null`: `${item},${this.adminCode},Null,0`;
      if (index == 0) {
        sql += `(TOLL_PID,ADMIN_CODE,TOLL_STATIC_STATE,TOLL_DYNAMIC_STATE) VALUES (${insertValue}) `;
      } else {
        sql += `INTO SC_TOLL_INDEX (TOLL_PID,ADMIN_CODE,TOLL_STATIC_STATE,TOLL_DYNAMIC_STATE) VALUES (${insertValue}) `;
      }
    });
    sql += `SELECT * FROM dual`;
    return sql;
  }

  /**
   * 对数据表进行更新
   */
  async updateTollGate() {
    const param = this.req.body.data;
    this.table = this.req.body.table;
    this.adminCode = this.req.body.adminCode;
    if (this.req.body.workFlag == 'dynamic') {
      this.db = new connectDynamicOracle();
    }
    let primaryKey = this.table === 'SC_TOLL_TOLLGATEFEE' ? 'TOLL_PID' : this.table === 'SC_TOLL_LIMIT' ? 'SYSTEM_ID' : this.table === 'SC_TOLL_RDLINK_BT' ? 'NAME_BT_ID' : 'GROUP_ID';
    if (this.table == 'SC_TOLL_HOLIDAY' || this.table == 'SC_TOLL_SPEFLOAT') {
      primaryKey = 'ID';
    }
    let pids = param.map(item => item[primaryKey.toLowerCase()]);
    let delSql = `DELETE FROM ${this.table} WHERE ${primaryKey} IN (${pids.join(',')})`;
    const delResult = await this.db.executeSql(delSql);
    if (delResult.rowsAffected != -1) {
      let insertSql = this._getInsertString(param);
      const insertResult = await this.db.executeSql(insertSql);
      if (insertResult.rowsAffected != -1) {
        // 如果与收费站有关的表有插入则更新index表;
        let priamry = this.table === 'SC_TOLL_TOLLGATEFEE' ? 'TOLL_PID' : 'GROUP_ID';
        if (this.tollRelateTable.indexOf(this.table) !=-1){
          let allTollPids = param.map(item => item[priamry.toLowerCase()]);
          // 查询allTollPids看有哪些完全不存在，执行插入操作；
          // 如果存在，则跟据当前workflag来判断到底是 编辑呢还是新增
          let allExistsResult = await this.selfDB.executeSql(`SELECT * FROM SC_TOLL_INDEX WHERE TOLL_PID IN (${allTollPids.join(',')})`);
          let allExistsDatas = changeResult(allExistsResult);
          let allExistsPids = allExistsDatas.map(item => item.toll_pid);
          let allUpdate_0_Pids = [];
          let allUpdate_1_Pids = [];
          allExistsDatas.forEach(item => {
            if (this.req.body.workFlag =='static') {
              if (item.toll_static_state == null || item.toll_static_state == 2) {
                allUpdate_0_Pids.push(item.toll_pid);
              }
              if (item.toll_static_state == 0) {
                allUpdate_1_Pids.push(item.toll_pid);
              }
            } else {
              if (item.toll_dynamic_state == null || item.toll_dynamic_state == 2) {
                allUpdate_0_Pids.push(item.toll_pid);
              }
              if (item.toll_dynamic_state == 0) {
                allUpdate_1_Pids.push(item.toll_pid);
              }
            }
          });
          let promiseArray = [];
          let field = this.req.body.workFlag =='static' ? 'TOLL_STATIC_STATE' : 'TOLL_DYNAMIC_STATE';
          if (allUpdate_0_Pids.length) {
            let batchInsertSql = `UPDATE SC_TOLL_INDEX SET ${field}=0 WHERE TOLL_PID IN (${allUpdate_0_Pids.join(',')})`;
            promiseArray.push(this.selfDB.executeSql(batchInsertSql));
          }
          if (allUpdate_1_Pids.length) {
            let batchUpdateSql = `UPDATE SC_TOLL_INDEX SET ${field}=1 WHERE TOLL_PID IN (${allUpdate_1_Pids.join(',')})`;
            promiseArray.push(this.selfDB.executeSql(batchUpdateSql));
          }
          let notExistsPids = allTollPids.filter(item => allExistsPids.indexOf(item) == -1);
          if (notExistsPids.length) {
            let batchInsertSql = this._getInsertStringSql(notExistsPids, this.req.body.workFlag);
            promiseArray.push(this.selfDB.executeSql(batchInsertSql));
          }
          if (promiseArray.length) {
            Promise.all(promiseArray)
            .then(proRes => {
              this.res.send({errorCode: 0});
            }).catch(err => {
              this.next(err);
            });
          } else {
            this.res.send({errorCode: 0});
          }
        } else {
          this.res.send({errorCode: 0});
        }
      } else {
        this.res.send({errorCode: -1});
      }
    } else {
      this.res.send({errorCode: -1});
    }
  }

  /**
   * 删除表中的收费站相关信息
   */
  async deleteCarTruckTollGate() {
    if (this.req.body.workFlag == 'dynamic') {
      this.db = new connectDynamicOracle();
    }
    this.table = this.req.body.table;
    let pid = this.req.body.pid;
    let delSql = `DELETE FROM ${this.table} WHERE GROUP_ID = ${pid}`;
    let delResult = await this.db.executeSql(delSql);
    if (delResult.rowsAffected != -1) { 
      // 如果删除成功，去查与收费站相关的表，如果不存在该收费站信息，则更新index表;
      let existFlag = await this.isTollgateExists(pid,this.table);
      if (!existFlag) {
        //将对应的状态改为删除2;
        let updateField = this.req.body.workFlag == 'dynamic'?'TOLL_DYNAMIC_STATE=2':'TOLL_STATIC_STATE=2';
        let updateSql = `UPDATE SC_TOLL_INDEX SET ${updateField} WHERE TOLL_PID=${pid}`;
        let updateRes = await this.selfDB.executeSql(updateSql);
        if (updateRes.rowsAffected != -1) {
          this.res.send({errorCode: 0, message: '删除成功', updateFlag: true});
        } else {
          this.res.send({errorCode: -1, message: '删除失败', updateFlag: false});
        }
      } else {
        this.res.send({errorCode: 0, message: '删除成功', updateFlag: false});
      }
    } else {
      this.res.send({errorCode: -1, message: '删除失败', updateFlag: false});
    }
  }

  /**
   * 查询一条收费站是否新增或删除过；
   */
  async isTollgateExists(pid, table) {
    let allTable = new Set(this.tollRelateTable);
    let currentTable = new Set([table]); 
    let differenceABSet = new Set([...allTable].filter(x => !currentTable.has(x)));
    differenceABSet = Array.from(differenceABSet);
    let existFlag = false;
    for (let i=0;i<differenceABSet.length;i++) {
      let primaryKey = (differenceABSet[i] === 'SC_TOLL_TOLLGATEFEE') ? 'TOLL_PID'  : 'GROUP_ID';
      let sql = `SELECT * FROM ${differenceABSet[i]} WHERE ${primaryKey}=${pid}`;
      let queryRes = await this.db.executeSql(sql);
      if (queryRes.rows.length) {// 如果有
        existFlag = true;
        break;
      }
    }
    return existFlag;
  }
  /**
   * toll_index表查询;
   */
  async _findTollgateIndex(primaryKey) {
    let sql = `SELECT * FROM SC_TOLL_INDEX WHERE TOLL_PID=${primaryKey}`;
    let qureyRes = await this.selfDB.executeSql(sql);
    return changeResult(qureyRes);
  }
  /**
   * 获得update部分语句
   * @param {*} data 
   */
  _getInsertString(data) {
    let tempString = 'INSERT ALL INTO  ' + this.table + ' ';
    for (let i = 0; i < data.length; i++) {
      if (i == 0) {
        tempString += '(' + Object.keys(data[i]).join(',') + ') VALUES ('
      } else {
        tempString += 'INTO ' + this.table + ' (' + Object.keys(data[i]).join(',') + ') VALUES ('
      }
      for (let key in data[i]) {
        if (key != 'command') {
          if (typeof data[i][key] === 'string') {
            tempString += "'" + data[i][key] + "',";
          } else {
            tempString += data[i][key] + ",";
          }
        }
      }
      tempString = tempString.substr(0, tempString.length - 1);
      tempString += (i == data.length - 1) ? ')' : ') ';
    }
    return tempString + ' SELECT * FROM dual';
  }

}

export default TollGate;
