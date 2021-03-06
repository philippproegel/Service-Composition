/**
 * Created by phili on 02.08.2016.
 */
/**
 * Created by PhilippMac on 25.07.16.
 */
'use strict';

var request = require('request'),
    winston = require('winston');


/**
 * Returns a directory specified by path
 * no sub-directories regarded
 * @param access_token
 * @param path
 * @param callback
 */
function getFileTree(access_token, path, callback) {
    _getFolderContentByPath(access_token, path, function (err, content) {
        if (err) {
            return callback(err);
        } else {
            return callback(null, _googleDirFormatToSimpleJSON(content));
        }
    });
}

/**
 * Gets a file from google
 * @param access_token
 * @param filePath
 * @param callback
 */
function getFile(access_token, filePath, callback) {
    var splitted = filePath.split('/');
    var pathWithoutFilename = "";
    var fileName = splitted[splitted.length - 1];
    //cut off filename
    for (var i = 0; i < splitted.length - 1; i++) {
        pathWithoutFilename += splitted[i];
        if (i <= splitted.length - 3) {
            pathWithoutFilename += '/';
        }
    }
    _getFolderContentByPath(access_token, pathWithoutFilename, function (err, content) {
        if (err) {
            return callback(err);
        } else {
            var fileId = _getFileIdFromFolderContentByName(content, fileName);
            var fileUrl = 'https://www.googleapis.com/drive/v3/files/' + fileId;
            if (fileName.indexOf('.') === -1) {
                fileUrl += '/export';
            }
            console.log(fileUrl);
            var options = {
                method: 'GET',
                uri: fileUrl,
                encoding: null,
                auth: {
                    bearer: access_token
                },
                qs: {
                    'alt': 'media',
                    'mimeType': 'application/pdf'
                }
            };
            var myRequest = request(options);
            return callback(null,myRequest);
        }
    });
}

function uploadFile(access_token, path, fileName, callback) {
    _getFolderIdByPath(access_token, path, function (err, id) {
        if (err) {
            return callback(err);
        } else {
            _uploadMetadata(access_token, id, fileName, function (err, id) {
                if (err) {
                    return callback(err);
                } else {
                    var url = 'https://www.googleapis.com/upload/drive/v2/files/' + id + '?uploadType=media';
                    console.log(url);
                    var options = {
                        method: 'PUT',
                        uri: url,
                        auth: {
                            bearer: access_token
                        }
                    };
                    var myRequest = request(options);
                    return callback(null,myRequest);
                }
            });
        }
    });
}

function createFolder(access_token,folderName,parentid, callback) {
    var mimeType = 'application/vnd.google-apps.folder';
    var url = 'https://www.googleapis.com/drive/v3/files';
    var options = {
        method: 'POST',
        uri: url,
        auth: {
            bearer: access_token
        },
        json: true,
        body: {
            name: folderName,
            mimeType: mimeType,
            parents: [
                parentid
            ]
        }
    };
    request(options, function (err, response) {
        if (err) {
            winston.log('error', 'application error: ', err);
            return callback({msg: err.message,code: 500});
        }
        if (response.statusCode >= 400 && response.statusCode <= 499) {
            winston.log('error', 'http error: ', err);
            return callback({msg: response.statusMessage,code: response.statusCode});
        }
        winston.log('info', 'successfully uploaded folder to google');
        return callback(null, response.body.id);
    });
}

function _uploadMetadata(access_token, parentid, fileName, callback) {
    var url = 'https://www.googleapis.com/drive/v3/files';
    var options = {
        method: 'POST',
        uri: url,
        auth: {
            bearer: access_token
        },
        json: true,
        body: {
            name: fileName,
            parents: [
                parentid
            ]
        }
    };
    request(options, function (err, response) {
        if (err) {
            winston.log('error', 'application error: ', err);
            return callback({msg: err,code: 500});
        }
        if (response.statusCode >= 400 && response.statusCode <= 499) {
            winston.log('error', 'http error: ', err);
            return callback({msg: response.statusMessage,code: response.statusCode});
        }
        winston.log('info', 'successfully uploaded metadata to google');
        return callback(null, response.body.id);
    });
}


/**
 * Parses directory content and retrieves id from specified filename
 * @param content
 * @param fileName
 * @returns {{id}}
 * @private
 */
function _getFileIdFromFolderContentByName(content, fileName) {
    var parsed = JSON.parse(content);
    var id = {};
    for (var i = 0; i < parsed.items.length; i++) {
        if (parsed.items[i].title === fileName) {
            id = parsed.items[i].id;
            break;
        }
    }
    return id;
}


function _getFolderId(access_token, parentId, folderName, callback) {
    var url = 'https://www.googleapis.com/drive/v2/files?q=mimeType=\'application/vnd.google-apps.folder\'andtitle=\'' + folderName + '\'and\'' + parentId + '\'+in+parents';
    console.log(url);
    var options = {
        method: 'GET',
        uri: url,
        auth: {
            bearer: access_token
        }
    };
    request(options, function (err, response, body) {
        if (err) {
            winston.log('error', 'application error: ', err);
            return callback(err);
        }
        if (response.statusCode >= 400 && response.statusCode <= 499) {
            winston.log('error', 'http error: ', err);
            return callback({msg: response.statusMessage,code: response.statusCode});
        }
        var items = JSON.parse(body).items;
        if (items.length === 0) {
            return callback({msg: 'not found',code: 500});
        }
        var id = items[0].id;
        winston.log('info', 'successfully got folderid from google for folder: %s', folderName);
        return callback(null, id);
    });
}

function _getFolderContentById(access_token, folderId, callback) {
    var url = 'https://www.googleapis.com/drive/v2/files/?q=trashed=falseand\'' + folderId + '\'+in+parents';
    console.log(url);
    var options = {
        method: 'GET',
        uri: url,
        auth: {
            bearer: access_token
        }
    };
    request(options, function (err, response, body) {
        if (err) {
            winston.log('error', 'application error: ', err);
            return callback({msg: err,code: 500});
        }
        if (response.statusCode >= 400 && response.statusCode <= 499) {
            winston.log('error', 'http error: ', err);
            return callback({msg: response.statusMessage,code: response.statusCode});
        }
        winston.log('info', 'successfully got filetree from google');
        return callback(null, body);
    });
}

function _getFolderContentByPath(access_token, path, callback) {
    //split up path
    var splitted = path.split('/');
    for(let i = 0;i<splitted.length;i++){
        if(splitted[i] === ''){
            splitted.splice(i,1);
            i--;
        }
    }
    var parent = 'root'; //root folder it is just root
    if (path === '' || path === '/') { //if root folder selected,directly get content
        _getFolderContentById(access_token, parent, function (err, content) {
            if (err) {
                return callback(err);
            } else {
                return callback(null, content);
            }
        });
    } else { //if subfolder selected,recursively iterate over folder to get the folderid
        var step = function (i) {
            _getFolderId(access_token, parent, splitted[i], function (err, id) {
                if (err) {
                    return callback(err);
                } else {
                    parent = id;
                    if (i === splitted.length - 1) { //real folder found,get contents
                        console.log('now get folder content');
                        _getFolderContentById(access_token, id, function (err, content) {
                            if (err) {
                                return callback(err);
                            } else {
                                return callback(null, content);
                            }
                        });
                    } else {
                        step(i + 1);
                    }
                }
            });
        };
        step(0);
    }
}

/**
 * Find id to folder specified by path
 * @param access_token
 * @param path
 * @param callback
 * @private
 */
function _getFolderIdByPath(access_token, path, callback) {
    //split up path
    var splitted = path.split('/');
    for(let i = 0;i<splitted.length;i++){
        if(splitted[i] === ''){
            splitted.splice(i,1);
            i--;
        }
    }
    var parent = 'root'; //root folder it is just root
    if (path === '' || path === '/') { //if root folder selected,directly get content
        return callback(null, 'root');
    } else { //if subfolder selected,recursively iterate over folder to get the folderid
        var step = function (i) {
            _getFolderId(access_token, parent, splitted[i], function (err, id) {
                if (err) {
                    //folder is not present,create it
                    createFolder(access_token,splitted[i],parent, function(err,folderId){
                        if(err){
                            return callback(err);
                        } else {
                            parent = folderId;
                            if (i === splitted.length - 1) { //real folder found,get contents
                                winston.log('info', 'folder id by path found: ', id);
                                return callback(null, parent);
                            } else {
                                step(i + 1);
                            }
                        }
                    });
                } else {
                    parent = id;
                    if (i === splitted.length - 1) { //real folder found,get contents
                        winston.log('info', 'folder id by path found: ', id);
                        return callback(null, id);
                    } else {
                        step(i + 1);
                    }
                }
            });
        };
        step(0);
    }
}


function _googleDirFormatToSimpleJSON(content) {
    var parsed = JSON.parse(content);
    var simpleJSONFormatArray = [];
    for (var i = 0; i < parsed.items.length; i++) {
        var simpleFormat = {};
        simpleFormat.name = parsed.items[i].title;
        if (parsed.items[i].mimeType === 'application/vnd.google-apps.folder') {
            simpleFormat.tag = 'folder';
            simpleFormat.contentLength = 0;
        } else {
            simpleFormat.tag = 'file';
            simpleFormat.contentLength = parsed.items[i].fileSize;
        }
        simpleJSONFormatArray.push(simpleFormat);
    }
    console.log(simpleJSONFormatArray.length);
    return simpleJSONFormatArray;
}


module.exports = {
    getFileTree: getFileTree,
    getFile: getFile,
    uploadFile: uploadFile,
    getFolderId: _getFolderId,
    createFolder: createFolder
};