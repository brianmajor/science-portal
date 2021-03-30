;(function($) {
  // register namespace
  $.extend(true, window, {
    cadc: {
      web: {
        science: {
          portal: {
            session: {
              PortalSession: PortalSession,
              // Events
              events: {
                onLoadSessionListDone: new jQuery.Event('sciPort:onLoadSessionListDone'),
                onLoadSessionListError: new jQuery.Event('sciPort:onLoadSessionListError'),
                onSessionDeleteOK: new jQuery.Event('sciPort:onSessionDeleteOK'),
                onSessionDeleteError: new jQuery.Event('sciPort:onSessionDeleteError'),
              }
            }
          }
        }
      }
    }
  })


  /**
   * Class for handling Skaha session interaction and data
   * @constructor
   */
  function PortalSession() {
    var _selfPortalSess = this
    var _isEmpty = true
    this._sessionList = {}
    this.sessionURLs = {}
    this.isPolling = false

    function setServiceURLs(URLObject) {
      _selfPortalSess.sessionURLs = URLObject
    }

    function initSessionList() {
      _isEmpty = true
      _selfPortalSess._sessionList = {}
    }

    function getSessionList() {
      if (_selfPortalSess._sessionList === {}) {
        initSessionList()
      }
      return _selfPortalSess._sessionList
    }

    function getSessionByID(sessionID) {
      var session = null
      for (var i = 0; i < _selfPortalSess._sessionList.length; i++) {
        if (_selfPortalSess._sessionList[i].id == sessionID) {
          session = _selfPortalSess._sessionList[i]
        }
      }
      return session
    }

    function getSessionByNameType(sessionData) {
      var session = null
      for (var i = 0; i < _selfPortalSess._sessionList.length; i++) {
        if ((_selfPortalSess._sessionList[i].name == sessionData.name) &&
        (_selfPortalSess._sessionList[i].type == sessionData.type) ) {
          session = _selfPortalSess._sessionList[i]
        }
      }
      return session
    }

    /**
     * Check if session for sessionID is of the given status
     * @param sessionID
     * @param sessionStatus
     * @returns {boolean}
     */
    function isSessionStatusByID(sessionID, sessionStatus) {
      var isStatus = false
      if (sessionID != {}) {
        var session = _selfPortalSess.getSessionByID(sessionID)
        if (session != null) {
          if (session.status == sessionStatus){
            isStatus = true
          }
        }
      }
      return isStatus
    }

    function isRunningSession(session) {
      return isSessionStatus(session, 'Running')
    }

    function isAllRunning() {
      var allRunning = true
      for (var i = 0; i < _selfPortalSess._sessionList.length; i++) {
        if (_selfPortalSess._sessionList[i].status !== 'Running') {
          allRunning = false
          break
        }
      }
      return allRunning
    }

    function isSessionStatus(session, sessionStatus) {
      var isStatus = false
      if (session.status == sessionStatus) {
        isStatus = true
      }
      return isStatus
    }

    /**
     * Build a default session name based on the session type and current count
     * of sessions
     * @param sessionType
     * @returns {*}
     */
    function getDefaultSessionName(sessionType) {
      // First entry will have a '1'
      var count = 1
      for (var i = 0; i < _selfPortalSess._sessionList.length; i++) {
        if (_selfPortalSess._sessionList[i].type === sessionType) {
          count++
        }
      }
      return sessionType + count
    }



    function setSessionList(sessionList) {
      if (sessionList.length > 0) {
        _selfPortalSess._sessionList = sessionList
        _selfPortalSess._isEmpty = false
      }
    }

    function isSessionListEmpty() {
      return _selfPortalSess._isEmpty
    }

    /**
     * Run this on page load to see if there's something to start up.
    */
    function loadSessionList() {
      Promise.resolve(getSessionListAjax(_selfPortalSess.sessionURLs.session, {}))
        .then(function(sessionList) {

          if (sessionList.length > 0) {
            setSessionList(sessionList)
          }
          trigger(_selfPortalSess, cadc.web.science.portal.session.events.onLoadSessionListDone)

        })
        .catch(function(message) {
          // get session list failed in a way that can't allow page to continue
          trigger(_selfPortalSess, cadc.web.science.portal.session.events.onLoadSessionListError, message)
        })
    }

    function getSessionListAjax(serviceURL, sessionData) {

      return new Promise(function (resolve, reject) {
        var request = new XMLHttpRequest()

        // 'load' is the XMLHttpRequest 'finished' event
        request.addEventListener(
          'load',
          function () {
            if (request.status === 200) {
              var jsonData = JSON.parse(request.responseText)
              resolve(jsonData)
            } else {
              reject(request)
            }
          },
          false
        )
        // withCredentials enables cookies to be sent
        // Note: SameSite cookie header isn't set with this method,
        // may cause problems with Chrome and other browsers? Feb 2021
        request.withCredentials = true
        request.open('GET', serviceURL)
        request.send(null)
      })
    }

    function deleteSession(sessionID) {
      Promise.resolve(deleteSessionAjax(_selfPortalSess.sessionURLs.session + "/" + sessionID, sessionID))
        .then(function(sessionID) {
          trigger(_selfPortalSess, cadc.web.science.portal.session.events.onSessionDeleteOK, sessionID)
        })
        .catch(function(message) {
          // get session list failed in a way that can't allow page to continue
          trigger(_selfPortalSess, cadc.web.science.portal.session.events.onSessionDeleteError, message)
        })
    }

    function deleteSessionAjax(serviceURL, sessionID) {
      return new Promise(function (resolve, reject) {
        var request = new XMLHttpRequest()

        // 'load' is the XMLHttpRequest 'finished' event
        request.addEventListener(
          'load',
          function () {
            if (request.status === 200) {
              resolve(sessionID)
            } else {
              reject(request)
            }
          },
          false
        )
        // withCredentials enables cookies to be sent
        // Note: SameSite cookie header isn't set with this method,
        // may cause problems with Chrome and other browsers? Feb 2021
        request.withCredentials = true
        request.open('DELETE', serviceURL)
        request.send(null)
      })
    }

    function pollSessionList(interval) {

        // TODO: consider long-running timeout so panel left in background doesn't use
        // resources forever
        interval = interval || 200

        var checkCondition = function (resolve, reject) {
          if (_selfPortalSess.isPolling == true) {
            resolve('running')
          }

          _selfPortalSess.isPolling = true

          getSessionListAjax(_selfPortalSess.sessionURLs.session)
            .then(function (sessionList) {
              _selfPortalSess.setSessionList(sessionList)
              if (_selfPortalSess.isAllRunning()) {
                // ensure polling flag is set to false
                _selfPortalSess.isPolling = false
                resolve()
              } else {
                // If neither of the conditions are met and the timeout
                // hasn't elapsed, go again
                // update info modal with current status?
                setTimeout(checkCondition, interval, resolve, reject)
              }
            })
            .catch(function (message) {
              reject(new Error('Error polling session list. Reload page to try again or contact CANFAR admin for assistance.'))
            })
        } // end checkCondition
        return new Promise(checkCondition)
    }

    function pollSessionRunning(sessionData, timeout, interval) {
      // Set a reasonable timeout
      var endTime = Number(new Date()) + (timeout || 10000)
      interval = interval || 200

      var checkCondition = function(resolve, reject) {

        getSessionListAjax(_selfPortalSess.sessionURLs.session)
          .then(function (sessionList) {
            _selfPortalSess.setSessionList(sessionList)
            var session = _selfPortalSess.getSessionByNameType(sessionData)
            if (session != null) {
              if (_selfPortalSess.isSessionStatus(session, 'Running')) {
                resolve(sessionData)
              } else if (Number(new Date()) < endTime) {
                // If neither of the conditions are met and the timeout
                // hasn't elapsed, go again
                // update info modal with current status?
                setTimeout(checkCondition, interval, resolve, reject)
              } else {
                // Didn't match and too much time, reject!
                reject(new Error('Waiting for session to start running. Try refreshing the page to list running sessions, or contact CANFAR admin for assistance.'))
              }
            } else {
              // could be that the system hasn't caught up to the request yet and
              // an empty return occurred
              setTimeout(checkCondition, interval, resolve, reject)
            }
          })
          .catch(function (message) {
            // TODO: these messages need tweaking
            reject(new Error('Waiting for session to start running. Try refreshing the page to list running sessions, or contact CANFAR admin for assistance.'))

          })
      } // end checkCondition
      return new Promise(checkCondition)
    }

    function pollSessionTerminated(sessionID, timeout, interval) {
      // Set a reasonable timeout
      var endTime = Number(new Date()) + (timeout || 10000)
      interval = interval || 200

      var checkCondition = function(resolve, reject) {

        getSessionListAjax(_selfPortalSess.sessionURLs.session)
          .then(function (sessionList) {
            _selfPortalSess.setSessionList(sessionList)
            var session = _selfPortalSess.getSessionByID(sessionID)
            if (session == null) {
                resolve(sessionData)
            } else if (Number(new Date()) < endTime) {
                // If neither of the conditions are met and the timeout
                // hasn't elapsed, go again
                // update info modal with current status?
                setTimeout(checkCondition, interval, resolve, reject)
            } else {
                // Didn't match and too much time, reject!
                reject(new Error('Waiting for session to start running. Try refreshing the page to list running sessions, or contact CANFAR admin for assistance.'))
            }

          })
          .catch(function (message) {
            //handleAjaxError(message)
            reject(new Error('Waiting for session to start running. Try refreshing the page to list running sessions, or contact CANFAR admin for assistance.'))

          })
      } // end checkCondition

      return new Promise(checkCondition)
    }

    // ---------- Event Handling Functions ----------

    function subscribe(target, event, eHandler) {
      $(target).on(event.type, eHandler)
    }

    function unsubscribe(target, event) {
      $(target).unbind(event.type)
    }

    function trigger(target, event, eventData) {
      $(target).trigger(event, eventData)
    }


    initSessionList()

      $.extend(this, {
        setServiceURLs: setServiceURLs,
        initSessionList: initSessionList,
        getDefaultSessionName: getDefaultSessionName,
        getSessionByID: getSessionByID,
        getSessionByNameType: getSessionByNameType,
        getSessionList: getSessionList,
        loadSessionList: loadSessionList,
        setSessionList: setSessionList,
        isAllRunning: isAllRunning,
        isSessionStatus: isSessionStatus,
        isRunningSession: isRunningSession,
        isSessionStatusByID: isSessionStatusByID,
        isSessionListEmpty : isSessionListEmpty,
        pollSessionList: pollSessionList,
        pollSessionRunning: pollSessionRunning,
        pollSessionTerminated: pollSessionTerminated,
        deleteSession: deleteSession,
      })
    }

})(jQuery)
