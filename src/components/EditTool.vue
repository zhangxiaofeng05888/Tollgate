<template>
  <div class="topToolsContainer">
    <div title="编辑收费站" style="border-left: none" @click="selectTool('RDTOLLGATE')">
      <img src="../assets/quickToolIcon/select.png"/>
    </div>
    <div title="地图漫游" @click="panMove()">
      <img src="../assets/quickToolIcon/mapPan.png"/>
    </div>
    <div title="新增收费站" @click="batchSelectTool('RDTOLLGATE')">
      <img src="../assets/quickToolIcon/copyPolygon.png"/>
    </div>
    <div title="线作业" v-show="dataSource === 2" @click="lineWork()">
      <img src="../assets/quickToolIcon/add-link.png"/>
    </div>
    <div title="面作业" class="batchDelete" v-show="dataSource === 2">
      <img src="../assets/quickToolIcon/drawPloygon.png"/>
      <ul class="typeList">
        <li @click="editAdminToll(1)">
          <span>编辑所有收费站</span>
        </li>
        <li @click="editAdminToll(2)">
          <span>新增收费信息</span>
        </li>
        <li @click="editAdminToll(3)">
          <span>编辑收费信息</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
    import startEditCtrl from '../uikits/startEditCtrl';
    import { appUtil } from '../Application';
    import '../uikits/controllers/EventController';
    import { getTollGateByAdminCode, getTollListByTollId } from '../dataService/api';
    export default {
      name: "edit-tool",
      data() {
        return {
          dataSource: 1,
          eventController: fastmap.uikit.EventController()
        }
      },
      methods: {
        panMove: function () {
          startEditCtrl.pan();
        },
        selectTool: function (type) {
          startEditCtrl.select(type);
        },
        batchSelectTool: function (type) {
          startEditCtrl.batchSelect(type);
        },
        lineWork: function () {
          this.$emit('lineWork')
        },
        editAdminToll: function (type) {
          let _self = this;
          const param = {
            adminCode: appUtil.getGolbalData().adminCode
          };
          let tollIds = [];
          let existTollIds = [];
          getTollGateByAdminCode(param).then(function (data) {
            if (data.errorCode === 0) {
              for (let i = 0; i < data.data.length; i++) {
                tollIds.push(data.data[i].group_id)
              }
              if (type === 1) {
                // 编辑所有收费信息 tollIds
                console.log(tollIds);
                _self.eventController.fire(L.Mixin.EventTypes.OBJECTSELECTED, { features: tollIds, event: event, flag:'insert',sourceFlag: 4 });
              } else {
                const param1 = {
                  tollIds: tollIds
                };
                getTollListByTollId(param1).then(function (data1) {
                  if (data1.errorCode === 0) {
                    for (let j = 0; j < data1.data.length; j++) {
                      existTollIds.push(data1.data[j].toll_pid);
                    }
                    if (type === 2) {
                      // 新增收费信息 differenceABSet
                      let a = new Set(tollIds);
                      let b = new Set(existTollIds)
                      let differenceABSet = new Set([...a].filter(x => !b.has(x)));
                      console.log([...differenceABSet]);
                      _self.eventController.fire(L.Mixin.EventTypes.OBJECTSELECTED, { features: [...differenceABSet], event: event, flag:'insert',sourceFlag: 4 });
                    } else {
                      // 编辑收费信息 existTollIds
                      console.log(existTollIds);
                      _self.eventController.fire(L.Mixin.EventTypes.OBJECTSELECTED, { features: existTollIds, event: event, flag:'insert',sourceFlag: 4 });
                      
                    }
                  }
                });
              }
            }
          });
        }
      },
      mounted() {
        this.dataSource = appUtil.getGolbalData().dataSource;
      }
    }
</script>

<style scoped>
  .topToolsContainer {
    box-shadow: 0 0 10px #93bbff;
    background-color: #FFFFFF;
    font-size: 0;
  }
  .topToolsContainer > div {
    width: 40px;
    height: 30px;
    text-align: center;
    line-height: 50px;
    cursor: pointer;
    display: inline-block;
    border-left: 1px solid #d2e1ff;
  }

  .topToolsContainer > div:hover {
    background-color: rgba(88, 150, 255, 0.1);
  }

  .topToolsContainer > div.disabled {
    background-color: rgba(24, 40, 72, 0.2);
    cursor: not-allowed;
  }
  .batchDelete:hover ul.typeList {
    display: block;
  }
  .batchDelete ul.typeList {
    list-style: none;
    padding: 0;
    position: absolute;
    top: 30px;
    background: #fff;
    border-radius: 3px;
    cursor: pointer;
    box-shadow: 0 2px 6px 0 #93bbff;
    width: 100px;
    text-align: center;
    display: none;
  }

  .batchDelete ul.typeList li {
    height: 24px;
    line-height: 24px;
    border: 1px solid transparent;
    font-size: 12px;
  }

  .batchDelete ul.typeList li:hover {
    border: 1px solid #5896ff;
    background-color: rgba(88, 150, 255, 0.1);
  }
  .batchDelete ul.typeList li.disabled {
    background-color: rgba(24, 40, 72, 0.2);
    cursor: not-allowed;
  }
</style>
