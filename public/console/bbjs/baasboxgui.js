/**
 * javascript functions for the Admin GUI 
 */


/**
 * Utility Functions
 * 
 */

/**
 * http://stackoverflow.com/a/2548133/487576
 * String endsWith
 */
String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

var userDataArray;
var roleDataArray;
var documentDataArray;
var settingDataArray;
var settingPwdDataArray;
var settingImgDataArray;
var settingSocialData = {};
var settingSectionChanged;
var settingPushDataArray;
var refreshSessionToken;
var settingPushMap = {};
var dbCollectionsCache = [];

$(document).ready(function(){
	setup();
});

function resetChosen(chosenElement){
	//Get the dynamic id given to your select by Chosen
	var selId = $(chosenElement).attr('id');
	//Use that id to remove the dynamically created div (the foe select box Chosen creates)
	$('#'+ selId +'_chzn').remove();
	//Change the value of your select, trigger the change event, remove the chzn-done class, and restart chosen for that select
	$('#'+selId).val('').change().removeClass('chzn-done').chosen();
}

function changeTopBarLink(bbId){
	var link = $($(".top-nav a.help")[0]);
	var href = link.attr("href")+"/"+bbId;
	link.attr("href",href);
	
}

function refreshCollectionCache(arr,fun){
	
	if(arr){
		dbCollectionsCache = arr;
		if(fun){
			var args = [].slice.call(dbCollectionsCache, 0)
			fun(dbCollectionsCache)
		}
	}else{
		BBRoutes.com.baasbox.controllers.Admin.getDBStatistics().ajax({
			success: function(data) {
				var data = data["data"];
				dbCollectionsCache = data["data"]["collections_details"];
				//console.debug(dbCollectionsCache,[].slice.call(dbCollectionsCache, 0));
				if(fun){
					fun(dbCollectionsCache)
				}

			}
		});
	}
}

//see http://codeaid.net/javascript/convert-size-in-bytes-to-human-readable-format-(javascript)
function bytesToSize(bytes, precision) {
	if (bytes){
		var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

		if (bytes == 0) return 'n/a';
		if (bytes < 1024) {
			return Number(bytes) + " " + sizes[0];
		}
		var posttxt = 0;
		do {
			posttxt++;
			bytes = bytes / 1024;
		} while( bytes >= 1024 );
		bytes=Math.round(bytes * 10) / 10
		return  bytes.toFixed(precision) + " " + sizes[posttxt];

	} else return "n/a";
}

$('.btn-newcollection').click(function(e){
	$('#newCollectionModal').modal('show');
	$("#newCollectionName").val("");
}); // Show Modal for new collection

$('#dropDb').click(function(e){
	$('#dropDbModal').modal('show');

});

$('#exportDb').click(function(e){
	BBRoutes.com.baasbox.controllers.Admin.exportDb().ajax(
			{
				error: function(data)
				{
					alert(JSON.parse(data.responseText)["message"]);

				},
				success: function(data)
				{
					alert("Your database backup has been scheduled");
				}

			});	
})
$('#dropDbCancel').click(function(e){
	$('#dropDbModal').modal('hide');
});

$('#dropDbConfirm').click(function(e){
	$('#dropDbModal').modal('hide');
	dropDb();


});

function dropDb()
{
	freezeConsole("dropping your db","please wait...")
	BBRoutes.com.baasbox.controllers.Admin.dropDb(5000).ajax(
			{
				error: function(data)
				{
					unfreezeConsole();
					alert(JSON.parse(data.responseText)["message"]);
				},
				success: function(data)
				{
					unfreezeConsole();
					callMenu('#dashboard');


				}

			})	
}

$('a.deleteCollection').live('click',function(e){
	var name = $(e.target).parents('tr').children()[0].innerHTML
	if(confirm("Are you sure you want to delete this collection?")){
		BBRoutes.com.baasbox.controllers.Admin.dropCollection(name).ajax({
			error:function(data){
				alert(JSON.parse(data.responseText)["message"]);
			},
			success: function(data){
				dbCollectionsCache = null;
				callMenu('#collections');
			}
		});
	}
})

$('a.deleteExport').live('click',function(e){

	var name = $(e.target).parents('tr').children()[0].innerHTML
	if(confirm("Are you sure you want to delete this backup file?")){
		BBRoutes.com.baasbox.controllers.Admin.deleteExport(name).ajax({
			error:function(data){
				alert(JSON.parse(data.responseText)["message"]);
			},
			success: function(data){

				callMenu('#dbmanager');
			}
		});
	}
});

$('a.downloadExport').live('click',function(e){
	var name = $(e.target).parents('tr').children()[0].innerHTML
	var xhr = new XMLHttpRequest();
	xhr.open('GET', BBRoutes.com.baasbox.controllers.Admin.getExport(name).absoluteURL(), true);
	xhr.setRequestHeader('X-BB-SESSION', sessionStorage.sessionToken);
	// Hack to pass bytes through unprocessed.
	xhr.overrideMimeType('text/plain; charset=x-user-defined');
	xhr.responseType = 'blob'
		xhr.onload = function(e) {
		if (this.status == 200) {
			var binStr = this.response;
			var BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder;
			var builder;
			var blob;
			if(!BlobBuilder){
				//console.debug("BlobBuilder is not available...Using plain BLOB")
				blob = new Blob([binStr],{ "type" : "application\/zip" });
			}else{
				builder = new BlobBuilder();
				builder.append(binStr);
				blob = builder.getBlob();
			}
			var urlGen = window.webkitURL || window.mozURL || window.URL
			var url = urlGen.createObjectURL(blob);
			$($("#downloadExportModal .modal-body")[0]).html("")
			.append($("<a id=\""+name+"\"/>")
					.attr({href: url})
					.attr("download",name)
					.append("Download:" + name))
					.on('click',function(e){
						$(e.target).remove();
						$('#downloadExportModal').modal('hide');
					});

			$('#downloadExportModal').modal('show');
		}

	};

	xhr.send();


});

function downloadExportHref(name){
	var reg = /(http:\/\/)(.*)/;
	var uri = BBRoutes.com.baasbox.controllers.Admin.getExport(name).absoluteURL(false);
	var match = uri.match(reg);
	if(match){
		return match[1] + $("#login").scope().username+":"+$("#login").scope().password+"@"+match[2] + "?X-BB-SESSION="+ sessionStorage.sessionToken +"&X-BAASBOX-APPCODE="+ escape($("#login").scope().appcode);
	}else{
		return '#';
	}


}



$('.btn-changepwd').click(function(e){
    resetChangePasswordForm();
    $('#changePwdModal').modal('show');
}); // Show Modal for Change Password Admin

$('.btn-adduser').click(function(e){
	loadUserRole();
	resetAddUserForm();
	$("#userTitle").text("Create a new User");
	$(".groupUserPwd").removeClass("hide");
	$("#txtUsername").removeClass("disabled");
	$("#txtUsername").prop('disabled', false);
	$('#addUserModal').modal('show');
}); // Show Modal for Add User


$('.btn-addRole').click(function(e){
	//console.debug("btn-addrole clicked");
	resetAddRoleForm();
	$("#roleTitle").text("Create a new Role");
	$('#addRoleModal').modal('show');
	$('#roleModalMode').text("insert");
}); // Show Modal for Add role

$('.btn-newAsset').click(function(e){

	$(".error").removeClass("error");
	$('#txtAssetName').val('');
	$('#txtAssetMeta').val('');
	$('#fuAsset').val('');
	$("#errorAsset").addClass("hide");	
	$(".filename").text("no file selected")	
	$('#addAssetModal').modal('show');
}); // Show Modal for New Asset

$('.btn-newFile').click(function(e){

	$(".error").removeClass("error");
	$('#txtFileName').val('');
	$('#txtFileAttachedData').val('');
	$('#fuFsset').val('');
	$("#errorFile").addClass("hide");	
	$(".filename").text("no file selected")	
	$('#addFileModal').modal('show');
}); // Show Modal for New File

$(".btn-action").live("click", function() {
	var action = $(this).attr("action");
	var actionType = $(this).attr("actionType");
	var parameters = $(this).attr("parameters");

	switch (action)	{
	case "insert":
		switch (actionType)	{
		case "user":
			break;
		case "collection":
			break;
		case "document":
			var collection=parameters;
			openDocumentEditForm(null,collection)
			break;
		case "asset":
			break;
		case "file":
			break;			
		}
		break;
	case "edit":
		switch (actionType)	{
		case "user":
			openUserEditForm(parameters);
			break;
		case "collection":
			break;
		case "setting":
			openSettingEditForm(parameters);
			break;
		case "document":
			//in this case the parameter is pair ID/COLLECTION
			var id=parameters.substring(0,36);
			var collection=parameters.substr(36);
			openDocumentEditForm(id,collection);
			break;
		case "asset":
			break;
		case "file":
			break;
		case "role":
			openRoleEditForm(parameters);
			break;	
		}
		break;
	case "changePwdUser":
		openChangePasswordUserForm(parameters);
			break;
	case "delete":
		switch (actionType)	{
		case "user":
			break;
		case "collection":
			break;
		case "asset":
			if(!confirm("Do you want to delete '"+ parameters +"' asset?"))
				return;
			deleteAsset(parameters);
			break;
		case "file":
			if(!confirm("Do you want to delete '"+ parameters +"' file?"))
				return;
			deleteFile(parameters);
			break;
		case "role":
			if(!confirm("Do you want to delete '"+ parameters +"' role? All users belonging to this role will be assigned ro the role 'registered'"))
				return;
			deleteRole(parameters);
			break;
		case "document":
		//in this case the parameter is pair ID/COLLECTION
			var id=parameters.substring(0,36);
			var collection=parameters.substr(36);
			if(!confirm("Are you sure you want to delete the '"+ id +"' document of the collection '"+collection+"' ?"))
				return;
			deleteDocument(collection,id);
			break;	
		}
		break;
		}
	});

function deleteAsset(assetName)
{
	BBRoutes.com.baasbox.controllers.Asset.delete(assetName).ajax(
			{
				data: {"name": assetName},
				error: function(data)
				{
					alert(JSON.parse(data.responseText)["message"]);
				},
				success: function(data)
				{
					loadAssetTable();
				}
			})	
}

function deleteFile(id)
{
	BBRoutes.com.baasbox.controllers.File.deleteFile(id).ajax(
			{
				data: {"id": id},
				error: function(data)
				{
					alert(JSON.parse(data.responseText)["message"]);
				},
				success: function(data)
				{
					loadFileTable();
				}
			})	
}

function deleteDocument(collection,id){
	BBRoutes.com.baasbox.controllers.Document.deleteDocument(collection,id,true).ajax(
			{
				error: function(data)	{
					alert(JSON.parse(data.responseText)["message"]);
				},
				success: function(data)	{
					$("#selectCollection").trigger("change");
				}
			})	
}

function deleteRole(roleName){
	BBRoutes.com.baasbox.controllers.Admin.deleteRole(roleName).ajax(
			{
				data: {"name": roleName},
				error: function(data)
				{
					alert(JSON.parse(data.responseText)["message"]);
				},
				success: function(data)
				{
					loadRoleTable();
				}
			})	
}

function openUserEditForm(editUserName){
    var userObject;
	resetAddUserForm();
	$("#txtUsername").addClass("disabled");
	$("#txtUsername").prop('disabled', true);
	$("#userTitle").text("Edit User information");
	$(".groupUserPwd").addClass("hide");
	for(i=0;i<userDataArray.length;i++)
	{
		if(userDataArray[i].user.name == editUserName)
			userObject = userDataArray[i];
	}
	$("#txtUsername").val(userObject.user.name);
    loadUserRole(userObject.user.roles[0].name);
	$("#txtVisibleByTheUser").val(reverseJSON(userObject.visibleByTheUser)).trigger("change");
	$("#txtVisibleByFriends").val(reverseJSON(userObject.visibleByFriends)).trigger("change");
	$("#txtVisibleByRegisteredUsers").val(reverseJSON(userObject.visibleByRegisteredUsers)).trigger("change");
	$("#txtVisibleByAnonymousUsers").val(reverseJSON(userObject.visibleByAnonymousUsers)).trigger("change");
	$('#addUserModal').modal('show');
}

function openChangePasswordUserForm(changePassword){
    resetChangePasswordUserForm()
    var userObject;
    $("#userTitle").text("Change password");
    $("#txtUserName").addClass("disabled");
    $("#txtUserName").prop('disabled', true);
    //$(".groupUserPwd").removeClass("hide");
    for(i=0;i<userDataArray.length;i++)
    {
        if(userDataArray[i].user.name == changePassword)
            userObject = userDataArray[i];
    }
    $("#txtUserName").val(userObject.user.name);
    $('#changePwdUserModal').modal('show');
}

function openRoleEditForm(editRoleName){
	var roleObject;
	resetAddRoleForm();
	$("#roleTitle").text("Edit Role information");
	$('#roleModalMode').text("edit");
	for(i=0;i<roleDataArray.length;i++)
	{
		if(roleDataArray[i].name == editRoleName)
			roleObject = roleDataArray[i];
	}
	$("#txtRoleName").val(roleObject.name);
	$("#roleOriginalName").val(roleObject.name);
	$("#txtRoleDescription").val(roleObject.description);
	$('#addRoleModal').modal('show');
}

function populateDocumentEditForm(docObject){
	$("#txtDocumentId").val(docObject.id);
	$("#txtDocumentAuthor").val(docObject["_author"]);
	$("#txtDocumentCreationDate").val(docObject["_creation_date"]);
	$("#txtDocumentVersion").val(docObject["@version"]);
	$("#txtDocumentCollection").val(docObject["@class"]);
	var obj = JSON.parse(JSON.stringify(docObject));
	delete obj["@rid"];
	delete obj["@class"];
	delete obj["@version"];
	delete obj["id"];
	delete obj["_author"];
	delete obj["_creation_date"];
	$("#txtDocumentData").val(JSON.stringify(obj, undefined, 2));
	$("#txtDocumentData").trigger("change");
}

function openDocumentEditForm(id,collection){
	var docObject;
	resetAddDocumentForm();
	$("#documentTitle").text(id!=null?"Edit Document":"Create New Document");
	$('#documentModalMode').text(id!=null?"edit":"insert");
	docObject = {}
	if(id!=null){
		for(i=0;i<documentDataArray.length;i++)
		{
			if(documentDataArray[i].id == id)
				docObject = documentDataArray[i];
		}
	}else{
		docObject["@class"] = collection;
	}
	populateDocumentEditForm(docObject);
	
	$('#addDocumentModal').modal('show');
}

function openSettingEditForm(editSettingName)
{
	var settingObject;

	for(i=0;i<settingDataArray.length;i++)
	{
		if(settingDataArray[i].key == editSettingName){
			settingSectionChanged = 'Application';
			settingObject = settingDataArray[i];
		}
	}
	for(i=0;i<settingPwdDataArray.length;i++)
	{
		if(settingPwdDataArray[i].key == editSettingName) {
			settingSectionChanged = 'PasswordRecovery';
			settingObject = settingPwdDataArray[i];
		}
	}
	for(i=0;i<settingImgDataArray.length;i++)
	{
		if(settingImgDataArray[i].key == editSettingName) {
			settingSectionChanged = 'Images';
			settingObject = settingImgDataArray[i];
		}

	}
	for(i=0;i<settingPushDataArray.length;i++)
	{
		if(settingPushDataArray[i].key == editSettingName) {
			settingSectionChanged = 'Push';
			settingObject = settingPushDataArray[i];
		}

	}	
	
	$("#lblDescription").text(settingObject.description);
	$("#txtKey").val(settingObject.key);
	$("#txtKey").addClass("disabled");
	$("#txtValue").val(settingObject.value);

	$('#EditSettingModal').modal('show');
}

function freezeConsole(title,reason){

	$('#freezeConsole__ .modal-header h2').html(title || "Please wait");
	$('#freezeConsole__ .modal-body').html("<p>"+reason+"</p>");
	$('#freezeConsole__').modal({keyboard:false,backdrop:'static'});

}

function unfreezeConsole(title,reason){
	$('#freezeConsole__').modal('hide');
	$('#freezeConsole__ .modal-header h2').html("");
	$('#freezeConsole__ .modal-body').html("");

}
function reverseJSON(objJSON)
{
	var strJSON = JSON.stringify(objJSON);

	if(strJSON == undefined)
		return "";

	var obj=JSON.parse(strJSON); 

	delete obj["_allow"];
	delete obj["_allowRead"];
	return JSON.stringify(obj, undefined, 2);
}

function loadFileTable()
{
	callMenu("#files");
}

function loadAssetTable()
{
	callMenu("#assets");
}

function loadRoleTable()
{
	callMenu("#roles");
}

function loadUserTable()
{
	callMenu("#users");
}

function loadSettingTable()
{
	callMenu("#settings");
}

function loadCollectionsTable()
{

	callMenu("#collections");
}

function resetAddUserForm()
{
	$("#userForm")[0].reset();
	$("#cmbSelectRole option:first").prop('selected',true)
	$("#cmbSelectRole").trigger("liszt:updated");
	$("#errorAddUser").addClass("hide");
	$(".error").removeClass("error");
}

function resetChangePasswordForm(){
    $("#changePwdForm")[0].reset();
    $("#errorCPwd").addClass("hide");
    $("#errorNewPassword").addClass("hide");
    $("#errorPwdNotMatch").addClass("hide");
}

function resetChangePasswordUserForm(){
    $("#changePwdUserForm")[0].reset();
    $("#errorNewPwd").addClass("hide");
    $("#errorPasswordNotMatch").addClass("hide");
}
function resetAddRoleForm(){
	//console.debug("resetAddRoleForm");
	$("#roleForm")[0].reset();
	$("#errorAddRole").addClass("hide");
	$("#errorAddRole2").addClass("hide");
	$(".error").removeClass("error");
}

function resetAddDocumentForm(){
	//console.debug("resetAddDocumentForm");
	$("#documentForm")[0].reset();
	$("#errorAddDocument").addClass("hide");
	$("#errorAddDocument2").addClass("hide");
	$(".error").removeClass("error");
}

function loadUserRole(defaultRole)
{
	BBRoutes.com.baasbox.controllers.Admin.getRoles().ajax({
		data: {orderBy: "name asc"},
		success: function(data) {
			var sel=$('#cmbSelectRole');
			sel.empty();
			sel.append($("<option/>"));
			data=data["data"];
			$.each(data, function(index, item) {
				sel.append($("<option/>", {
					value: item["name"],
					text: item["name"]
				}));
			});
			$("#cmbSelectRole").trigger("liszt:updated");
			if (defaultRole) {
				$("#cmbSelectRole option:contains('"+defaultRole+"')").prop('selected',true);
				$("#cmbSelectRole").trigger("liszt:updated");
			}
		}});
}


function addRole() {
	var roleName = $("#txtRoleName").val();
	var desc = $("#txtRoleDescription").val();
	BBRoutes.com.baasbox.controllers.Admin.createRole(roleName).ajax(
			{
				data: JSON.stringify({"description": desc}),
				contentType: "application/json",
				processData: false,
				error: function(data)
				{
					alert(JSON.parse(data.responseText)["message"]);
				},
				success: function(data)
				{
					closeRoleForm();
				}
			})	
}
function updateRole(){
	var roleName = $("#txtRoleName").val();
	var roleOriginalName = $("#roleOriginalName").val();
	var desc = $("#txtRoleDescription").val();

	BBRoutes.com.baasbox.controllers.Admin.editRole(roleOriginalName).ajax(
			{
				data: JSON.stringify({"description": desc,"new_name": roleName}),
				contentType: "application/json",
				processData: false,
				error: function(data)
				{
					alert(JSON.parse(data.responseText)["message"]);
				},
				success: function(data)
				{
					closeRoleForm();
				}
			})	
}//updateRole

function addDocument(){
	var collection=$("#txtDocumentCollection").val();
	var data=JSON.parse($("#txtDocumentData").val());
	BBRoutes.com.baasbox.controllers.Document.createDocument(collection).ajax(
			{
				data: JSON.stringify(data),
				contentType: "application/json",
				processData: false,
				error: function(data)
				{
					var error=JSON.parse(data.responseText);
					var message=error["message"];
					var bb_code=error["bb_code"];
					if (bb_code=="40001") message += " HINT: reload the document from the server and redo your update";
					$("#errorAddDocument").text(message).removeClass("hide");
				},
				success: function(data)
				{
					closeDocumentForm();
				}
			})	
}//addDocument



function updateDocument(){
	var id=$("#txtDocumentId").val();
	var collection=$("#txtDocumentCollection").val();
	var version=$("#txtDocumentVersion").val();
	var data=JSON.parse($("#txtDocumentData").val());
	data["@version"]=parseInt(version);
	
	BBRoutes.com.baasbox.controllers.Document.updateDocument(collection,id,true).ajax(
			{
				data: JSON.stringify(data),
				contentType: "application/json",
				processData: false,
				error: function(data)
				{
					var error=JSON.parse(data.responseText);
					var message=error["message"];
					var bb_code=error["bb_code"];
					if (bb_code=="40001") message += " HINT: reload the document from the server and redo your update";
					alert(message);
					$("#errorAddDocument").text(message).removeClass("hide");
				},
				success: function(data)
				{
					closeDocumentForm();
				}
			})	
}//updateDocument

function closeDocumentForm() {
	$('#addDocumentModal').modal('hide');
	$("#selectCollection").trigger("change");
}


function closeRoleForm() {
	$('#addRoleModal').modal('hide');
	loadRoleTable();
}

function addUser()
{
	var userName = $("#txtUsername").val();
	var password = $("#txtPassword").val();
	var role = $("#cmbSelectRole").val();
	var visibleByTheUser = ($("#txtVisibleByTheUser").val() == "") ? "{}": $("#txtVisibleByTheUser").val(); 
	var visibleByFriends = ($("#txtVisibleByFriends").val() == "") ? "{}": $("#txtVisibleByFriends").val();
	var visibleByRegisteredUsers = ($("#txtVisibleByRegisteredUsers").val() == "") ? "{}": $("#txtVisibleByRegisteredUsers").val();
	var visibleByAnonymousUsers = ($("#txtVisibleByAnonymousUsers").val() == "") ? "{}": $("#txtVisibleByAnonymousUsers").val();

	BBRoutes.com.baasbox.controllers.Admin.createUser().ajax(
			{
				data: JSON.stringify({"username": userName,
					"password": password,
					"role": role,
					"visibleByTheUser": jQuery.parseJSON(visibleByTheUser),
					"visibleByFriends": jQuery.parseJSON(visibleByFriends),
					"visibleByRegisteredUsers": jQuery.parseJSON(visibleByRegisteredUsers),
					"visibleByAnonymousUsers": jQuery.parseJSON(visibleByAnonymousUsers)
				}),
				contentType: "application/json",
				processData: false,
				error: function(data)
				{
					alert(JSON.parse(data.responseText)["message"]);
				},
				success: function(data)
				{
					closeUserForm();
				}
			})	
}

function updateUser()
{
	var userName = $("#txtUsername").val();
	var password = $("#txtPassword").val();
	var role = $("#cmbSelectRole").val();
	var visibleByTheUser = ($("#txtVisibleByTheUser").val() == "") ? "{}": $("#txtVisibleByTheUser").val(); 
	var visibleByFriends
        = ($("#txtVisibleByFriends").val() == "") ? "{}": $("#txtVisibleByFriends").val();
	var visibleByRegisteredUsers = ($("#txtVisibleByRegisteredUsers").val() == "") ? "{}": $("#txtVisibleByRegisteredUsers").val();
	var visibleByAnonymousUsers = ($("#txtVisibleByAnonymousUsers").val() == "") ? "{}": $("#txtVisibleByAnonymousUsers").val();

	BBRoutes.com.baasbox.controllers.Admin.updateUser(userName).ajax(
			{
				data: JSON.stringify({
					"role": role,
					"visibleByTheUser": jQuery.parseJSON(visibleByTheUser),
					"visibleByFriends": jQuery.parseJSON(visibleByFriends),
					"visibleByRegisteredUsers": jQuery.parseJSON(visibleByRegisteredUsers),
					"visibleByAnonymousUsers": jQuery.parseJSON(visibleByAnonymousUsers)
				}),	
				contentType: "application/json",
				processData: false,
				error: function(data)
				{
					alert(JSON.parse(data.responseText)["message"]);
				},
				success: function(data)
				{
					closeUserForm();
				}
			})	
}

function closeUserForm()
{
	$('#addUserModal').modal('hide');
	loadUserTable();
}

function updateSetting()
{
	var key = $("#txtKey").val();
	var value = $("#txtValue").val();
	var ajaxProps = BBRoutes.com.baasbox.controllers.Admin.setConfiguration(settingSectionChanged,"dummy",key,'');
	var url = ajaxProps.url.substr(0,ajaxProps.url.length-1).replace('/dummy/','/');
	$.ajax(
			{
				method:'PUT',
				type:'PUT',
				url: url,
				contentType:'application/json',
				data:JSON.stringify({value:value}),
				error: function(data)
				{
					////console.debug(data);
					var error=JSON.parse(data.responseText);
					var message=error["message"];
					alert("Error updating settings:" + message);
				},
				success: function(data)
				{
					closeSettingForm();
				}
			})	
}



function closeSettingForm()
{
	$('#EditSettingModal').modal('hide');
	loadSettingTable();
}

$('.btn-RoleCommit').click(function(e){
	var action=$('#roleModalMode').text();
	var roleName = $("#txtRoleName").val();
	var desc = $("#txtRoleDescription").val();
	var errorMessage = '';
	$("#errorAddRole").addClass("hide");
	
	if($.trim(roleName) == "")	errorMessage = "The 'Role name' field is required<br/>"
	if(errorMessage != "")
	{
		$("#errorAddRole").html(errorMessage);
		$("#errorAddRole").removeClass("hide");
		return;
	}

	if(action == "insert")
		addRole();
	else
		updateRole();
	return;
}); // Validate and Ajax submit for Insert/Update Role


$('.btn-DocumentCommit').click(function(e){
	var errorMessage = '';
	$("#errorAddDocument").addClass("hide");
	var action=$('#documentModalMode').text();
	var data=$("#txtDocumentData").val();
	if ($.trim(data)=="") $("#txtDocumentData").val("{}");
	//check json data
	try{
		$.parseJSON(data);
	}catch (e) {
        errorMessage+="Please provide data in JSON format. "
		if ($.trim(data).indexOf("{") != 0) errorMessage+=" HINT: check if the data fields are between {..}";
    }
	if(errorMessage != "")	{
		$("#errorAddDocument").html(errorMessage);
		$("#errorAddDocument").removeClass("hide");
		return;
	}

	if(action == "insert")	addDocument();
	else updateDocument();
	return;
}); // Validate and Ajax submit for Insert/Update Document

$('.btn-DocumentReload').click(function(e){
	var errorMessage = '';
	$("#errorAddDocument").addClass("hide");
	
	var id=$("#txtDocumentId").val();
	var collection=$("#txtDocumentCollection").val();
	
	BBRoutes.com.baasbox.controllers.Document.getDocument(collection,id,true).ajax(
			{
				error: function(data)
				{
					var error=JSON.parse(data.responseText);
					var message=error["message"];
					alert(JSON.parse(message));
					$("#errorAddDocument").text(message);
					$("#errorAddDocument").removeClass("hide");
				},
				success: function(data)	{
				    populateDocumentEditForm(data["data"]);
					$("#selectCollection").trigger("change");
				}
			});	
	return;
}); // Validate and Ajax submit for reload document

$('.btn-UserCommit').click(function(e){
    var action;

	var userName = $("#txtUsername").val();
	var password = $("#txtPassword").val();
	var retypePassword = $("#txtRetypePassword").val();
	var role = $("#cmbSelectRole").val();
	var visibleByTheUser = ($("#txtVisibleByTheUser").val() == "") ? "{}": $("#txtVisibleByTheUser").val(); 
	var visibleByFriends = ($("#txtVisibleByFriends").val() == "") ? "{}": $("#txtVisibleByFriends" +
        "").val();
	var visibleByRegisteredUsers = ($("#txtVisibleByRegisteredUsers").val() == "") ? "{}": $("#txtVisibleByRegisteredUsers").val();
	var visibleByAnonymousUsers = ($("#txtVisibleByAnonymousUsers").val() == "") ? "{}": $("#txtVisibleByAnonymousUsers").val();

	var errorMessage = '';

	if($('.groupUserPwd').hasClass('hide'))
		action = "Update";
	else
		action = "Insert";

	if($.trim(userName) == "")
		errorMessage = "The 'Username' field is required<br/>"

			if(action == "Insert"){
				if($.trim(password) == "")
					errorMessage += "The 'Password' field is required<br/>"

						if($.trim(retypePassword) == "")
							errorMessage += "The 'Retype Password' field  is required<br/>"

								if(password != retypePassword)
								{
									$(".groupUserPwd").addClass("error");
									errorMessage += "'Password' and 'Retype Password' fields don't match<br/>"
								}
								else
									$(".groupUserPwd").removeClass("error");		
			}

	if($.trim(role) == "")
		errorMessage += "The 'Role' field  is required<br/>"

			if(!isValidJson(visibleByTheUser)){
				$("#auVisibleByTheUser").addClass("error");
				errorMessage += "The 'Visible By The User' field  must be a valid JSON string<br/>"
			}
			else
				$("#auVisibleByTheUser").removeClass("error");

	if(!isValidJson(visibleByFriends)){
		$("#auVisibleByFriend").addClass("error");
		errorMessage += "The 'Visible By Friend' field  must be a valid JSON string<br/>"
	}
	else
		$("#auVisibleByFriend").removeClass("error");

	if(!isValidJson(visibleByRegisteredUsers)){
		$("#auVisibleByRegisteredUsers").addClass("error");
		errorMessage += "The 'Visible By Registered Users' field  must be a valid JSON string<br/>"
	}
	else
		$("#auVisibleByRegisteredUsers").removeClass("error");

	if(!isValidJson(visibleByAnonymousUsers)){
		$("#auVisibleByAnonymousUsers").addClass("error");
		errorMessage += "The 'Visible By Anonymous Users' field  must be a valid JSON string<br/>"
	}
	else
		$("#auVisibleByAnonymousUsers").removeClass("error");

	if(errorMessage != "")
	{
		$("#errorAddUser").html(errorMessage);
		$("#errorAddUser").removeClass("hide");
		return;
	}

	if(action == "Insert")
		addUser();
	else
		updateUser();

	return;
}); // Validate and Ajax submit for Insert/Update User

$('.btn-SettingCommit').click(function(e){
	var action;

	var key = $("#txtKey").val();
	var value = $("#txtValue").val();

	var errorMessage = '';

	if($.trim(key) == "")
		errorMessage = "The field 'Key' is required<br/>"

			if($.trim(value) == "")
				errorMessage += "The field 'Value' is required<br/>"

					if(errorMessage != "")
					{
						$("#errorEditSetting").html(errorMessage);
						$("#errorEditSetting").removeClass("hide");
						return;
					}
	$("#txtKey").removeClass("disabled");
	updateSetting();

	return;
}); // Validate and Ajax submit for Update Setting


function isValidJson(code)
{
	try {
		JSON.parse(code);
		return true;
	} catch (e) {
		return false;
	}
}

$('.btn-NewCollectionCommit').click(function(e){

	var collectionName = $("#newCollectionName").val();

	if($.trim(collectionName) == '')
	{
		return;
	}		

	BBRoutes.com.baasbox.controllers.Admin.createCollection(collectionName).ajax(
			{
				data: JSON.stringify({"name": collectionName}),
				contentType: "application/json",
				processData: false,
				error: function(data)
				{
					alert(JSON.parse(data.responseText)["message"]);
				},
				success: function(data)
				{
					$('#newCollectionModal').modal('hide');
					dbCollectionsCache = null;
					loadCollectionsTable();
				}
			})	
}); // Validate and Ajax submit for new collection

$('.btn-ChangePwdCommit').click(function(e){

	var oldPassword = $("#oldpassword").val();
	var newPassword = $("#newpassword").val();

	if($("#password").val() != oldPassword)
	{
        $("#errorCPwd").removeClass("hide");
		return;
	}
	else
		$("#errorCPwd").addClass("hide");

	if(newPassword != $("#retypenewpassword").val())
	{
        $("#errorPwdNotMatch").removeClass("hide");
		return;
	}		
	else
		$("#errorPwdNotMatch").addClass("hide");

	if($.trim(newPassword) == '')
	{
        $("#errorNewPassword").removeClass("hide");
		return;
	}		
	else
		$("#errorNewPassword").addClass("hide");

	BBRoutes.com.baasbox.controllers.User.changePassword().ajax(
			{
				data: JSON.stringify({"old": oldPassword,"new": newPassword}),
				contentType: "application/json",
				processData: false,
				error: function(data)
				{
					alert(JSON.parse(data.responseText)["message"]);
				},
				success: function(data)
				{
					sessionStorage.password = newPassword;
					$('#changePwdModal').modal('hide');
				}
			})	
}); // Validate and Ajax submit for Change Password


$('.btn-ChangePwdUserCommit').click(function(e){
    var userName = $("#txtUserName").val();
    var txtPwd=$("#txtPwd").val();
    if(txtPwd != $("#txtRetypePwd").val())
    {
        $("#errorPasswordNotMatch").removeClass("hide");
        return;
    }
    else
        $("#errorPasswordNotMatch").addClass("hide");

    if($.trim(txtPwd) == '')
    {
        $("#errorNewPwd").removeClass("hide");
        return;
    }
    else
        $("#errorNewPwd").addClass("hide");

    BBRoutes.com.baasbox.controllers.Admin.changePassword(userName).ajax(
        {
            data: JSON.stringify({"password": txtPwd}),
            contentType: "application/json",
            processData: false,
            error: function(data)
            {
                alert(JSON.parse(data.responseText)["message"]);
            },
            success: function(data)
            {
                sessionStorage.password = txtPwd;
                $('#changePwdUserModal').modal('hide');
            }
        })

});


$('#importBtn').on('click',function(e){
	e.preventDefault();
	$('#importErrors').addClass("hide");
	$('#importErrors').html("");
	var filename = $('#zipfile').val();
	if(filename==null ||filename==''){
		$('#importErrors').removeClass("hide");
		$('#importErrors').html("You have to pick a file to restore")
		return false;
	}
	$('#importModal').modal('show');
	return false;
});

$('#startImport').on('click',function(){
	$('#importModal').modal('hide');
	$('#importDbForm').submit();
});

$('#stopImport').on('click',function(){
	$('#importModal').modal('hide');
});

$('#importDbForm').on('submit',function(){
	$('#importErrors').addClass("hide");
	$('#importErrors').html("");
	var filename = $('#zipfile').val();
	if(filename==null ||filename==''){
		$('#importErrors').removeClass("hide");
		$('#importErrors').html("You have to pick a file to restore")
		return false;
	}
	var ext = $('#zipfile').val().split('.').pop().toLowerCase();
	var serverUrl=BBRoutes.com.baasbox.controllers.Admin.importDb().absoluteURL();
	if (window.location.protocol == "https:"){
		serverUrl=serverUrl.replace("http:","https:");
	}
	var options = {
			url: serverUrl,
			type: "post",
			clearForm: true,
			resetForm: true,
			success: function(){
				unfreezeConsole();
				BBRoutes.com.baasbox.controllers.User.logoutWithoutDevice().ajax({}).always(
						function() { 
							sessionStorage.up="";
							sessionStorage.appcode="";
							sessionStorage.sessionToken="";
							location.reload(); 
						});
			}, //success
			error:function(data){
				unfreezeConsole();
				$('#importErrors').removeClass("hide");
				$('#importErrors').html(JSON.parse(data.responseText)["message"]);
			} //error
	};

	freezeConsole("","Importing your data...please wait");
	$(this).ajaxSubmit(options);
	return false;
})

$('#assetForm').submit(function() {

	var assetName = $("#txtAssetName").val();
	var assetMeta = ($("#txtAssetMeta").val() == "") ? "{}": $("#txtAssetMeta").val();

	var errorMessage = '';

	if($.trim(assetName) == "")
		errorMessage = "The field 'Name' is required<br/>"

//			if($.trim(assetMeta) == "")
//			errorMessage += "The field 'Meta' is required<br/>"

			if(!isValidJson(assetMeta)){
				$("#divAssetMeta").addClass("error");
				errorMessage += "The field 'Meta' must be a valid JSON string<br/>"
			}
			else
				$("#divAssetMeta").removeClass("error");

	var ext = $('#fuAsset').val().split('.').pop().toLowerCase();
	/*if($.inArray(ext, ['gif','png','jpg','jpeg','tif','eps','pdf','doc','docx','xls','xlsx','ppt','pptx','txt','']) == -1) {
		errorMessage += "Invalid File Extension<br/>"
	}*/		

	if(errorMessage != "")
	{
		$("#errorAsset").html(errorMessage);
		$("#errorAsset").removeClass("hide");
		return;
	}

	if ($.trim(assetMeta) == "") 
		assetMeta = "{}";

	var serverUrl=BBRoutes.com.baasbox.controllers.Asset.post().absoluteURL();
	if (window.location.protocol == "https:"){
		serverUrl=serverUrl.replace("http:","https:");
	}

	var options = {
			url: serverUrl,
			type: "post",
			dataType: "json",
			clearForm: true,
			resetForm: true,
			success: function(){
				$('#addAssetModal').modal('hide');
				loadAssetTable();
			}, //success
			error: function(data) {
				$("#errorAsset").removeClass("hide").html(JSON.parse(data.responseText)["message"])
			}
	};

	$(this).ajaxSubmit(options);

	return false;
})// Validate and Ajax submit for new Asset

$('#fileForm').submit(function() {

	var fileMeta = ($.trim($("#txtFileAttachedData").val()) == "") ? "{}": $("#txtFileAttachedData").val();
	var fileName = ($.trim($('#fuFile').val()))
	
	var errorMessage = '';

	if(!isValidJson(fileMeta)){
		$("#divFileAttachedData").addClass("error");
		errorMessage += "The attached JSON data must be a valid JSON string<br/>";
	}else
		$("#divFileAttachedData").removeClass("error");
	
	if  (!fileName.length){
		$("#divFileUpload").addClass("error");
		errorMessage += "You must specify a file to upload<br/>";
	}else
		$("#divFileUpload").removeClass("error");


	if(errorMessage != "")
	{
		$("#errorFile").html(errorMessage);
		$("#errorFile").removeClass("hide");
		return;
	}


	var serverUrl=BBRoutes.com.baasbox.controllers.File.storeFile().absoluteURL();
	if (window.location.protocol == "https:"){
		serverUrl=serverUrl.replace("http:","https:");
	}

	var options = {
			url: serverUrl,
			type: "post",
			dataType: "json",
			clearForm: true,
			resetForm: true,
			success: function(){
				$('#addFileModal').modal('hide');
				loadFileTable();
			}, //success
			error: function(data) {
				$("#errorFile").removeClass("hide").html(JSON.parse(data.responseText)["message"])
			}
	};

	$(this).ajaxSubmit(options);

	return false;
})// Validate and Ajax submit for new File




function make_base_auth(user, password) {
	var tok = user + ':' + password;
	var hash = btoa(tok);
	return "Basic " + hash;
}

function setup(){

	setupAjax();
	setupMenu();
	setupTables();
	setupSelects();

	$('.logout').click(function(e){
		BBRoutes.com.baasbox.controllers.User.logoutWithoutDevice().ajax({}).always(
				function() { 
					sessionStorage.up="";
					sessionStorage.appcode="";
					sessionStorage.sessionToken="";
					location.reload(); 
				});
	});

	if (sessionStorage.up && sessionStorage.up!="") {
		tryToLogin();
	}	
}

function getActionButton(action, actionType,parameters){

	var iconType;
	var classType;
	var labelName;

	switch (action)	{
	case "edit":
		iconType = "icon-edit";
		classType = "btn-info";
		labelName = "Edit";
		break;
	case "changePwdUser":
		iconType = "icon-lock";
		classType = "btn-warning";
		labelName = "Change PWD";
		break;	
	case "delete":
		iconType = "icon-trash";
		classType = "btn-danger";
		labelName = "Delete...";
		break;
	}
	var actionButton = "<a class='btn "+ classType +" btn-action' action='"+ action +"' actionType='"+ actionType +"' parameters='"+ parameters +"' href='#'><i class='"+ iconType +"'></i> "+ labelName +"</a>";
	return actionButton;
}


function setBradCrumb(type)
{
	var sBradCrumb;

	switch (type){
	case "#roles":
		sBradCrumb = "Roles";
		break;	
	case "#users":
		sBradCrumb = "Users";
		break;
	case "#dashboard":
		sBradCrumb = "Dashboard";
		break;
	case "#settings":
		sBradCrumb = "Settings";
		break;
	case "#dbmanager":
		sBradCrumb = "DB Manager";
		break;
	case "#collections":
		sBradCrumb = "Collections";
		break;
	case "#documents":
		sBradCrumb = "Documents";
		break;
	case "#assets":
		sBradCrumb = "Assets";
		break;
	case "#files":
		sBradCrumb = "Files";
		break;
	}

	$("#bradcrumbItem").text(sBradCrumb);
}

function getFileIcon(type,id){
	var sIcon="";
	var iconPath = "img/AssetIcons/";
	var sContent = "content";
	var serverUrl=BBRoutes.com.baasbox.controllers.File.streamFile("").absoluteURL();
	if (window.location.protocol == "https:"){
		serverUrl=serverUrl.replace("http:","https:");
	}
	switch (type){
	case "image/png":
	case "image/jpeg":
	case "image/gif":
	case "image/tiff":
	case "image/jpg":
		sIcon = "/file/"+id+"?X-BB-SESSION="+escape(sessionStorage.sessionToken)+"&X-BAASBOX-APPCODE="+escape($("#login").scope().appcode)+"&resize=<=40px"
		sContent="image";
		break;
	case "application/zip":
		sIcon = iconPath + "zip.png";
		break;
	case "image/eps":
		sIcon = iconPath + "eps.png";
		break;
	case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		sIcon = iconPath + "word.png";
		break;
	case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
		sIcon = iconPath + "excel.png";
		break;
	case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
		sIcon = iconPath + "ppt.png";
		break;
	case "application/pdf":
		sIcon = iconPath+ "pdf.png";
		break;
	default :
		sIcon = iconPath + "file.png";
		break;
	}
	if (sIcon=="") return "";
	var ret = "<img style='width:40px; height:45px' title='"+type+"' alt='"+type+"' src='"+ sIcon +"'/><br />"
	ret += "<a href='"+(sContent=="content"?"view-source:":"")+serverUrl+(sContent=="content"?"content/":"") + id+"?X-BB-SESSION="+escape(sessionStorage.sessionToken)+"&X-BAASBOX-APPCODE="+escape($("#login").scope().appcode)+"' title='"+(sContent=="content"?"It only works with Chrome and Firefox":"")+"' target='_blank'>View "+sContent+"</a> ";
	ret += "<a href='/file/details/"+id+"?X-BB-SESSION="+escape(sessionStorage.sessionToken)+"&X-BAASBOX-APPCODE="+escape($("#login").scope().appcode)+"' target='_blank' >Show details</a>"
	return ret;
}

function getAssetIcon(type)
{
	var sIcon="";

	switch (type){
	case "application/zip":
		sIcon = "zip.png";
		break;
	case "image/png":
		sIcon = "png.png";
		break;
	case "image/jpeg":
		sIcon = "jpg.png";
		break;
	case "image/gif":
		sIcon = "gif.png";
		break;
	case "image/tiff":
		sIcon = "tiff.png";
		break;
	case "image/eps":
		sIcon = "eps.png";
		break;
	case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		sIcon = "word.png";
		break;
	case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
		sIcon = "excel.png";
		break;
	case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
		sIcon = "ppt.png";
		break;
	case "application/pdf":
		sIcon = "pdf.png";
		break;
	default :
		sIcon = "file.png";
		break;
	}
	if (sIcon=="") return "";
	return "<img style='width:40px; height:45px' title='"+type+"' alt='"+type+"' src='img/AssetIcons/"+ sIcon +"'/>";
}


function setupTables(){
	$('#roleTable').dataTable( {
		"sDom": "R<'row-fluid'<'span6'l><'span6'f>r>t<'row-fluid'<'span12'i><'span12 center'p>>",
		"sPaginationType": "bootstrap",
		"oLanguage": {"sLengthMenu": "_MENU_ records per page"},
		"aoColumns": [ {"mData": "name"},
		               {"mData": "description"},
		               {"mData": "modifiable", "mRender": function ( data, type, full ) {
		            	   if(data) //role is modifiable
		            		   return getActionButton("edit","role",full.name) +" "+ getActionButton("delete","role",full.name);
		            	   return "No action available";
		               }
		               }],
		               "bRetrieve": true,
		               "bDestroy":true
	} ).makeEditable();
	$('#userTable').dataTable( {
		"sDom": "R<'row-fluid'<'span6'l><'span6'f>r>t<'row-fluid'<'span12'i><'span12 center'p>>",
		"sPaginationType": "bootstrap",
		"oLanguage": {"sLengthMenu": "_MENU_ records per page"},
		"aoColumns": [ {"mData": "user.name"},
		               {"mData": "user.roles.0.name"},
		               {"mData": "signUpDate","sDefaultContent":""},
		               {"mData": "user.status","mRender": function ( data, type, full ) {
		            	   var classStyle="label-success"
		            		   if (data!="ACTIVE") classStyle="label-important";
		            	   var htmlReturn="<span class='label "+classStyle+"'>"+data+"</span> ";
		            	   return htmlReturn;
		               }
		               },
		               {"mData": "user.name", "mRender": function ( data, type, full ) {
		            	   if(data!="admin" && data!="baasbox" && data!="internal_admin")
		            		   return getActionButton("edit","user",data)+"&nbsp;"+getActionButton("changePwdUser","user",data);// +" "+ getActionButton("delete","user",data);
		            	   return "No action available";
		               }
		               }],
		               "bRetrieve": true,
		               "bDestroy":true
	} ).makeEditable();

	$('#settingsTable').dataTable( {
		"sDom": "R<'row-fluid'<'span6'l><'span6'f>r>t<'row-fluid'<'span12'i><'span12 center'p>>",
		"sPaginationType": "bootstrap",
		"oLanguage": {"sLengthMenu": "_MENU_ records per page"},
		"aoColumns": [ {"mData": "key"},
		               {"mData": "description"},
		               {"mData": "value", "mRender":function ( data, type, full ) {
		            	   return $('<div/>').text(data).html();
		               }
		               },

		               {"mData": "key", "mRender": function ( data, type, full ) {
		            	   if (full.editable) return getActionButton("edit","setting",data);
		            	   else return "";
		               }
		               }],

		               "bRetrieve": true,
		               "bDestroy":false
	} ).makeEditable();

	$('#settingsPwdTable').dataTable( {
		"sDom": "R<'row-fluid'<'span6'l><'span6'f>r>t<'row-fluid'<'span12'i><'span12 center'p>>",
		"sPaginationType": "bootstrap",
		"oLanguage": {"sLengthMenu": "_MENU_ records per page"},
		"aoColumns": [ {"mData": "key"},
		               {"mData": "description"},
		               {"mData": "value", "mRender":function ( data, type, full ) {
		            	   return $('<div/>').text(data).html();
		               }
		               },
		               {"mData": "key", "mRender": function ( data, type, full ) {
		            	   if (full.editable) return getActionButton("edit","setting",data);
		            	   else return "";
		               }
		               }],

		               "bRetrieve": true,
		               "bDestroy":false
	} ).makeEditable();

	$('#settingsImgTable').dataTable( {
		"sDom": "R<'row-fluid'<'span6'l><'span6'f>r>t<'row-fluid'<'span12'i><'span12 center'p>>",
		"sPaginationType": "bootstrap",
		"oLanguage": {"sLengthMenu": "_MENU_ records per page"},
		"aoColumns": [ {"mData": "key"},
		               {"mData": "description"},
		               {"mData": "value", "mRender":function ( data, type, full ) {
		            	   return $('<div/>').text(data).html();
		               }
		               },
		               {"mData": "key", "mRender": function ( data, type, full ) {
		            	   if (full.editable) return getActionButton("edit","setting",data);
		            	   else return "";
		               }
		               }],

		               "bRetrieve": true,
		               "bDestroy":false
	} ).makeEditable();

	$('#settingsPushTable').dataTable( {
		"sDom": "R<'row-fluid'<'span6'l><'span6'f>r>t<'row-fluid'<'span12'i><'span12 center'p>>",
		"sPaginationType": "bootstrap",
		"oLanguage": {"sLengthMenu": "_MENU_ records per page"},
		"aoColumns": [ {"mData": "key"},
		               {"mData": "description"},
		               {"mData": "value", "mRender":function ( data, type, full ) {
		            	   return $('<div/>').text(data).html();
		               }
		               },
		               {"mData": "key", "mRender": function ( data, type, full ) {
		            	   if (full.editable) return getActionButton("edit","setting",data);
		            	   else return "";		               }
		               }],

		               "bRetrieve": true,
		               "bDestroy":false
	} ).makeEditable();

	$('#exportTable').dataTable( {
		"sDom": "R<'row-fluid'<'span6'l><'span6'f>r>t<'row-fluid'<'span12'i><'span12 center'p>>",
		"aaSorting": [[ 2, "desc" ]],
		"sPaginationType": "bootstrap",
		"aoColumns": [ {"mData": "name"},
		               {"mData": "date"},
		               {"mData":null,"mRender":function(data,type,full){return "<div class=\"btn-group\"> <a class=\"btn downloadExport\" href=\"#\">Download</a> <a class=\"btn btn-danger deleteExport\">Delete</a> </div>"}}
		               ],
		               "bRetrieve": true,
		               "bDestroy":true

	});
	$('#collectionTable').dataTable( {
		"sDom": "R<'row-fluid'<'span6'l><'span6'f>r>t<'row-fluid'<'span12'i><'span12 center'p>>",
		"sPaginationType": "bootstrap",
		"oLanguage": {"sLengthMenu": "_MENU_ records per page"},
		"aoColumns": [ {"mData": "name"},
		               {"mData":"records"},
		               {"mData":null,"mRender":function(data,type,full){return "<div class=\"btn-group\"><a class=\"btn btn-danger deleteCollection\">Delete...</a>"}}],
		               "bRetrieve": true,
		               "bDestroy":true
	} ).makeEditable();

	$('#documentTable').dataTable( {
		"sDom": "R<'row-fluid'<'span6'l><'span6'f>r>t<'row-fluid'<'span12'i><'span12 center'p>>",
		"sPaginationType": "bootstrap",
		"oLanguage": {"sLengthMenu": "_MENU_ records per page"},
		"aoColumns": [{"mData": "_creation_date",sWidth:"85px","mRender": function ( data, type, full ) 	{
    	    			var datetime = data.split("T"); 
    	    			return "<span style='font-family:Courier'>"+datetime[0]+"<br/>"+datetime[1]+"</span>";
						}
					   },
					   {"mData": "id", sWidth:"280px","mRender": function ( data, type, full ) 	{
			 				return "<span style='font-family:Courier'>"+data+"</span>";
						}
					   },
		               {"mData": "_author"},
		               {"mData": "@rid","mRender": function ( data, type, full ) 	{
		            	   var obj=JSON.parse(JSON.stringify(full)); 
		            	   delete obj["@rid"];
		            	   delete obj["@class"];
		            	   delete obj["@version"];
						   delete obj["id"];
						   delete obj["_author"];
						   delete obj["_creation_date"];
		            	   return "<pre>" + JSON.stringify(obj, undefined, 2) + "</pre>";
						},bSortable:false
		               },
		               {"mData": "id","mRender": function ( data, type, full ) {
							var obj=JSON.parse(JSON.stringify(full)); 
		            	   return getActionButton("edit","document",data + obj["@class"]) + "&nbsp;" + getActionButton("delete","document",data+obj["@class"]);
		            	},bSortable:false,bSearchable:false
		               }
		               ],
		               "bRetrieve": true,
		               "bDestroy":true
	} ).makeEditable(); 

	$('#btnReloadDocuments').click(function(){
		$("#selectCollection").trigger("change");
	});
	$('#btnReloadExports').click(function(){
		callMenu('#dbmanager')
	});
	$('#assetTable').dataTable( {
		"sDom": "R<'row-fluid'<'span6'l><'span6'f>r>t<'row-fluid'<'span12'i><'span12 center'p>>",
		"sPaginationType": "bootstrap",
		"oLanguage": {"sLengthMenu": "_MENU_ records per page"},
		"aoColumns": [ 
		              {"mData": "@class", "mRender": function (data, type, full ) {
		            	  var obj=JSON.parse(JSON.stringify(full));
		            	  if(data =="_BB_FileAsset")
		            		  return getAssetIcon(obj["contentType"]);
		            	  return "";
		              }},
		              {"mData": "name"},
		              {"mData": "@class", "mRender": function ( data, type, full ) {
		            	  var obj=JSON.parse(JSON.stringify(full));
		            	  if(obj["meta"] != undefined)
		            	  {
		            		  return JSON.stringify(obj["meta"]);
		            	  }
		            	  else
		            	  {
		            		  return "";
		            	  }
		              }},
		              {"mData": "@class", "mRender": function (data, type, full ) {
		            	  var obj=JSON.parse(JSON.stringify(full));
		            	  if(data =="_BB_FileAsset")
		            		  return  bytesToSize(obj["contentLength"],'KB');
		            	  return "";
		              }},
		              {"mData": "@class", "mRender": function (data, type, full ) {
		            	  var obj=JSON.parse(JSON.stringify(full));
		            	  if(data =="_BB_FileAsset")
		            		  return obj["contentType"];
		            	  return "";
		              }},
		              {"mData": "@class", "mRender": function (data, type, full) {
		            	  var obj=JSON.parse(JSON.stringify(full));
		            	  if(data =="_BB_FileAsset")
		            		  return "<a href='/asset/" + obj["name"] + "/download?X-BAASBOX-APPCODE="+ escape($("#login").scope().appcode) +"' target='_new'>"+ obj["fileName"] +"</a>";
		            	  return "";
		              }},
		              {"mData": "name", "mRender": function (data) {
		            	  return getActionButton("delete","asset",data);
		              }}
		              ],
		              "bRetrieve": true,
		              "bDestroy":true
	} ).makeEditable();
	
	$('#fileTable').dataTable( {
		"sDom": "R<'row-fluid'<'span6'l><'span6'f>r>t<'row-fluid'<'span12'i><'span12 center'p>>",
		"sPaginationType": "bootstrap",
		"oLanguage": {"sLengthMenu": "_MENU_ records per page"},
		"aoColumns": [ 
		              {"mData": "id", sWidth:"42px","mRender": function (data, type, full ) {
		            	  var obj=JSON.parse(JSON.stringify(full));
		            	  return getFileIcon(obj["contentType"],obj["id"]);
		              }},
					   {"mData": "id", sWidth:"180px","mRender": function ( data, type, full ) 	{
			 				return "<span style='font-family:Courier'>"+data+"</span>";
						}
					   },
		              {"mData": "id", "mRender": function ( data, type, full ) {
		            	  var obj=JSON.parse(JSON.stringify(full));
		            	  if(obj["attachedData"] != undefined)
		            	  {
		            		  return "<pre>" + JSON.stringify(obj["attachedData"],undefined,2) + "</pre>";
		            	  }
		            	  else
		            	  {
		            		  return "";
		            	  }
		              },bSortable:false},
		              {"mData": "id", "mRender": function (data, type, full ) {
		            	  var obj=JSON.parse(JSON.stringify(full));
	            		  return  bytesToSize(obj["contentLength"],'KB');
		              }},
		         /*     {"mData": "id", "mRender": function (data, type, full ) {
		            	  var obj=JSON.parse(JSON.stringify(full));
	            		  return obj["contentType"];
		              }},*/
		              {"mData": "id", sWidth:"210px","mRender": function (data, type, full) {
		            	  var obj=JSON.parse(JSON.stringify(full));
	            		  return "<a href='/file/" + obj["id"] + "?download=true&X-BB-SESSION="+escape(sessionStorage.sessionToken)+"&X-BAASBOX-APPCODE="+ escape($("#login").scope().appcode) +"' target='_new'>"+ obj["fileName"] +"</a>";
		              }},
		              {"mData": "id", "mRender": function (data) {
		            	  return getActionButton("delete","file",data);
		              }}
		              ],
		              "bRetrieve": true,
		              "bDestroy":true
	} ).makeEditable();
	
} //setupTables()

function setupSelects(){

	$("#selectCollection").chosen().change(function(){
		val=$("#selectCollection").val();
		BBRoutes.com.baasbox.controllers.Document.getDocuments(val).ajax({
			data: {orderBy: "name asc"},
			success: function(data) {
				data=data["data"];
				var scope=$("#documents").scope();
				scope.$apply(function(){
					scope.collectionName=val;
				});	
				$('#documentTable').dataTable().fnClearTable();
				$('#documentTable').dataTable().fnAddData(data);
				documentDataArray=data;
			}
		})//BBRoutes.com.baasbox.controllers.Document.getDocuments
	});//selectCollection
}

function setupAjax(){
	$.ajaxSetup({
		beforeSend: function (xhr){ 
			xhr.setRequestHeader('X-BB-SESSION', sessionStorage.sessionToken);
		},
		statusCode: {
			401: function(){
				alert("Sorry, session expired. You must login again");
				location.reload();
			}
		}
	}
	);
	//hack for charisma menu
	$('#for-is-ajax').hide();
	$('#is-ajax').prop('checked',true);
}//setupAjax

function setupMenu(){
	//ajaxify menus
	$('a.ajax-link').click(function(e){
		if($.browser.msie) e.which=1;
		e.preventDefault();
		var $clink=$(this);
		callMenu($clink.attr('href'));
		$('ul.main-menu li.active').removeClass('active');
		$clink.parent('li').addClass('active');
	});
	$(".directLink").unbind("click");
	//initializeTours
	$(".tour").click(function(){
		for (var key in tours) {
			var tour = tours[key];
			if (!tour.ended()) tour.end();
		}
		tours[$(this).data("tour")].restart();
	});
}//setupMenu

function initializeData(action,data){
	var scope=$('#settings').scope();
	scope.$apply(function(){
		scope.$broadcast(action+"-data",data);
	});
}

function applySuccessMenu(action,data){
	$('#loading').remove();
	var scope=$("#loggedIn").scope();
	scope.$apply(function(){
		scope.menu=action.substr(1);
	});
	var scope=$(action).scope();
	scope.$apply(function(){
		scope.data=data;
	});	

}//applySuccessMenu 


function callMenu(action){
	var scope=$("#loggedIn").scope();
	scope.$apply(function(){
		scope.menu="";
	});
	$('#loading').remove();
	$('#content').parent().append('<div id="loading" class="center">Loading...<div class="center"></div></div>');

	setBradCrumb(action);

	switch (action)	{
	case "#roles":
		BBRoutes.com.baasbox.controllers.Admin.getRoles().ajax({
			data: {orderBy: "name asc"},
			success: function(data) {
				roleDataArray = data["data"];
				//console.debug("Admin.getRoles success:");
				//console.debug(data);
				applySuccessMenu(action,roleDataArray);
				$('#roleTable').dataTable().fnClearTable();
				$('#roleTable').dataTable().fnAddData(roleDataArray);
			}
		});
		break;//#users
	case "#users":
		BBRoutes.com.baasbox.controllers.Admin.getUsers().ajax({
			data: {orderBy: "user.name asc"},
			success: function(data) {
				userDataArray = data["data"];
				//console.debug("Admin.getUsers success:");
				//console.debug(data);
				applySuccessMenu(action,userDataArray);
				$('#userTable').dataTable().fnClearTable();
				$('#userTable').dataTable().fnAddData(userDataArray);
			}
		});
		break;//#users
	case "#dashboard":
		BBRoutes.com.baasbox.controllers.Admin.getLatestVersion().ajax({
			success: function(data)	{
				var data = data["data"];
				$('#latestVersion').text(data["latest_version"]);
				var url=data["announcement_url"];
				if (url=="") url = data["download_url"];
				$('#getLatestVersion').prop("href", url);
				if ($('#currentVersion').text()<data["latest_version"]+"") {
					$('#notificationLatestVersion').text("!");
					$('#notificationLatestVersion').addClass("notification red");
				}
			}, //success
			error: function(data){
				$('#latestVersion').addClass("red").text("Unable to reach BaasBox site");
				$('#notificationLatestVersion').text("?");
				$('#notificationLatestVersion').addClass("notification yellow");
			}
		});//BBRoutes.com.baasbox.controllers.Admin.getLatestVersion().ajax
		BBRoutes.com.baasbox.controllers.Admin.getDBStatistics().ajax({
			success: function(data) {
				var data = data["data"];
				applySuccessMenu(action,data);
				var platformSpecificFeed={
						"bbid": data["installation"]["bb_id"],
						"bbv":  data["installation"]["bb_version"],
						"odbv": data["db"]["properties"]["version"],
						"osn": data["os"]["os_name"],
						"osa": data["os"]["os_arch"],
						"osv": data["os"]["os_version"],
						"c": data["os"]["processors"],
						"jvmmm": data["memory"]["max_allocable_memory"],
						"jvv": data["java"]["java_vendor"],
						"jve": data["java"]["java_version"],
						"rand": Math.random().toString(36).substr(2,7)
				};
				refreshCollectionCache(data["data"]["collections_details"],function(dd){
					//console.debug("refreshed ", dd)
				});
				var bbId = data["installation"]["bb_id"];
				var bbv = data["installation"]["bb_version"];
				if(bbId){
					changeTopBarLink(bbId);
				}

				$('#latestNewsTab').rssfeed('http://www.baasbox.com/feed/', {
					header: false,
					dateformat: "date",
					content:true,
					snippet:true,
					linktarget: "_blank",
					linkcontent: true,
					limit: 5,
					errormsg: "Unable to retrieve latest news"
				});
				var serverPlatform=getPlatform(data["os"]["os_name"]);
				$('#platformNameNews').text(data["os"]["os_name"]);
				$('#platformNewsTab').rssfeed('http://www.baasbox.com/tag/'+serverPlatform+'/feed/?' + $.param(platformSpecificFeed,true), 
						{
					header: false,
					dateformat: "date",
					content:true,
					snippet:true,
					linktarget: "_blank",
					linkcontent: true,
					limit: 5,
					errormsg: "Unable to retrieve latest news about BaasBox on " + data["os"]["os_name"] + " platform"
						});
				if (localStorage.generalTour!=bbv) 
					tours["general"].restart();
				localStorage.generalTour=bbv;
			}//success function
		});//ajax call

		break;	//#dashboard
	case "#settings":		
		BBRoutes.com.baasbox.controllers.Admin.getConfiguration("Application").ajax({
			success: function(data) {
				//console.debug("dumpConfiguration Application success:");
				//console.debug(data);
				settingDataArray = data["data"];
				
				
				//applySuccessMenu(action,data);
				$('#settingsTable').dataTable().fnClearTable();
				$('#settingsTable').dataTable().fnAddData(settingDataArray);
			}
		});
		BBRoutes.com.baasbox.controllers.Admin.getConfiguration("PasswordRecovery").ajax({
			success: function(data) {
				//console.debug("dumpConfiguration PasswordRecovery success:");
				//console.debug(data);
				settingPwdDataArray = data["data"];
				//applySuccessMenu(action,data);
				$('#settingsPwdTable').dataTable().fnClearTable();
				$('#settingsPwdTable').dataTable().fnAddData(settingPwdDataArray);
			}
		});
		BBRoutes.com.baasbox.controllers.Admin.getConfiguration("Push").ajax({
			success: function(data) {
				//console.debug("dumpConfiguration Push success:");
				settingPushDataArray = data["data"];
				//console.debug(settingPushDataArray);
				settingPushMap = {}
				
				settingPushMap.add = function(setting,section){
					if(settingPushMap[section]==null){
						settingPushMap[section]=[];
					}
					settingPushMap[section].push(setting)
				};
				$(settingPushDataArray).each(function(i,setting){
					var k = setting["key"];
					
					if(k.endsWith(".certificate")){
						setting["file"] = true
						if(setting.value){
							setting["filename"] = JSON.parse(setting.value).name
						}
					}else{
						setting["file"] = false;
					}
					if(k.indexOf('.apple.')>-1 || k.indexOf('.ios.')>-1){
						settingPushMap.add(setting,'ios');
					}else if(k.indexOf('.android')>-1){
						settingPushMap.add(setting,'android');
					}else{
						settingPushMap.add(setting,'push');
					}
				})
				initializeData("push",settingPushMap);
				//applySuccessMenu(action,data);
				
			}
		});
		BBRoutes.com.baasbox.controllers.Admin.getConfiguration("Images").ajax({
			success: function(data) {

				settingImgDataArray = data["data"];
				
				$('#settingsImgTable').dataTable().fnClearTable();
				$('#settingsImgTable').dataTable().fnAddData(settingImgDataArray);
			}
		});
		
		BBRoutes.com.baasbox.controllers.Admin.getConfiguration("Social").ajax({
			success: function(data) {
				var result =  data["data"];
				for(var i=0;i<result.length;i++){
					var components = result[i]["key"].split(".");
					var key = components[1];
					var component = components[2];
					//console.log(result)
					if(!settingSocialData[key]){
						settingSocialData[key] = {}
					}
					if(component.indexOf("token")>-1){
						settingSocialData[key]["token"] = result[i]["value"] == 'null' ? '' : result[i]["value"];
					}else if(component.indexOf("secret")>-1){
						settingSocialData[key]["secret"] = result[i]["value"] == 'null' ? '' : result[i]["value"];;
					}else if(component.indexOf("enabled")>-1){
						var def = result[i]["value"] == undefined ? false : result[i]["value"] == "true" ? true : false;
						settingSocialData[key]["enabled"] = def;
						//console.log("enabled?",def);
						settingSocialData[key]["saved"] = def;
						
					}
					
					
				}
				
				applySuccessMenu(action,settingSocialData);
				
				
			}
		});
		break;	//#settings

	case "#dbmanager":
		BBRoutes.com.baasbox.controllers.Admin.getExports().ajax({
			success: function(data){
				applySuccessMenu(action,data["data"]);

			}
		});
		break;

	case "#collections":
		var collections = [];
		var ref = function(coll){
			//console.debug("refreshing",coll);
			collections = coll;
			applySuccessMenu(action,collections);
			$('#collectionTable').dataTable().fnClearTable();
			$('#collectionTable').dataTable().fnAddData(collections);
		}
		if(dbCollectionsCache){
				collections = dbCollectionsCache;
				ref(collections)
		}else{
			refreshCollectionCache(null,function(dd){
				
				collections = dd;
				ref(collections)
			});
		}
		break;//#collections
	case "#documents":
		$('#documentTable').dataTable().fnClearTable();
		BBRoutes.com.baasbox.controllers.Admin.getCollections().ajax({
			data: {orderBy: "name asc"},
			success: function(data) {
				data=data["data"];
				applySuccessMenu(action,data);
				var sel=$('#selectCollection');
				sel.empty();

				resetChosen("#selectCollection");

				sel.append($("<option/>"));
				$.each(data, function(index, item) {
					sel.append($("<option/>", {
						value: item["name"],
						text: item["name"]
					}));
				});
				sel.trigger("liszt:updated");
			}
		});
		break; //#documents
	case "#assets":
		BBRoutes.com.baasbox.controllers.Asset.getAll().ajax({
			data: {orderBy: "name asc"},
			success: function(data) {
				data=data["data"];
				applySuccessMenu(action,data);
				////console.debug("getAll");
				////console.debug(data);
				$('#assetTable').dataTable().fnClearTable();
				$('#assetTable').dataTable().fnAddData(data);
			}
		});
		case "#files":
		BBRoutes.com.baasbox.controllers.File.getAllFile().ajax({
			data: {orderBy: "_creation_date asc"},
			success: function(data) {
				data=data["data"];
				applySuccessMenu(action,data);
				$('#fileTable').dataTable().fnClearTable();
				$('#fileTable').dataTable().fnAddData(data);
				$.trim($('#fuFile').val(""));
			}
		});
		break;//#files	  
	}
}//callMenu

function RolesController($scope){

}
function AssetsController($scope){
}
function FilesController($scope){
}
function UsersController($scope){
}
function CollectionsController($scope){
}
function DocumentsController($scope){
}

function tryToLogin(user, pass,appCode){
	BBRoutes.com.baasbox.controllers.User.login().ajax({
		data:{username:user,password:pass,appcode:appCode},
		success: function(data) {
			sessionStorage.sessionToken=data["data"]["X-BB-SESSION"];
			//console.debug("login success");
			//console.debug("data received: ");
			//console.debug(data);
			//console.debug("sessionStorage.sessionToken: " + sessionStorage.sessionToken);
			callMenu("#dashboard");
			//refresh the sessiontoken every 5 minutes
			refreshSessionToken=setInterval(function(){BBRoutes.com.baasbox.controllers.Generic.refreshSessionToken().ajax();},300000);
			var scope=$("#loggedIn").scope();
			scope.$apply(function(){
				scope.loggedIn=true;
			});
		},
		error: function() {
			$("#errorLogin").removeClass("hide");
		}
	});	 //ajax
}//tryToLogin	

function LoginController($scope) {
	$scope.login = function() {
		var username=$scope.username;
		var password=$scope.password;
		var appCode=$scope.appcode;
		tryToLogin(username, password,appCode);
	}; //login
}	//LoginController

function SettingsController($scope){
	

	$scope.sociallogins = $scope.data;
	
	$scope.$watch('data',function(){
		$scope.sociallogins = $scope.data;
	});
	
	$scope.showForm = function(name){
		$scope.sociallogins[name].enabled = true;
		$scope.sociallogins[name].saved = false;
	}
	
	
	
	
	
	$scope.disable = function(name){
		var toModify = $scope.sociallogins[name];
		toModify.enabled = false;
		toModify.saved = false;
		toModify.token = null;
		toModify.secret = null;
		var key = "social."+name+".token"
		var value = toModify.token;
		
		updateSettings(key,value,function(){
			var key2 = "social."+name+".secret"
			var value2 = toModify.secret;
			updateSettings(key2,value2,function(){
				var key3 = "social."+name+".enabled"
				var value3 = false;
				updateSettings(key3,value3,null);
			})
		})
		
	}
	
	
	function updateSettings(key,value,onSuccess){
		var ajaxProps = BBRoutes.com.baasbox.controllers.Admin.setConfiguration("Social","dummy",key, '');
		var url = ajaxProps.url.substr(0,ajaxProps.url.length-1).replace('/dummy/','/')
		$.ajax(
				{
					method:'PUT',
					type:'PUT',
					url:url,
					contentType : 'application/json',
					data: JSON.stringify({value:value}),
					error: function(data)
					{
						//console.log(data)
						alert("Error updating settings:" + data["message"]);
					},
					success: function(data)
					{
						if(onSuccess)
							onSuccess();
					}
				});
	}
	
	$scope.postsocialsettings = function(name){
		var toModify = $scope.sociallogins[name];
		toModify.errors = [];
		if(!toModify.token || toModify.token == null || toModify.token===''){
			toModify.errors.push('Token can\'t be empty');
		}
		if(!toModify.secret || toModify.secret == null || toModify.secret===''){
			toModify.errors.push('Secret can\'t be empty');
		}
		if(toModify.errors.length > 0){
			return;
		}else{
			var key = "social."+name+".token"
			var value = toModify.token;
			
			updateSettings(key,value,function(){
				console.log("saving token")
				var key2 = "social."+name+".secret"
				var value2 = toModify.secret;
				updateSettings(key2,value2,function(){
					console.log("saving secret")
					var key3 = "social."+name+".enabled"
					var value3 = "true";
					updateSettings(key3,value3,function(){
						console.log("enabling")
						$scope.sociallogins[name].saved = true;
					});
					
				})
			})
			
				

		}
		
	}
	
	
	
}

function DBManagerController($scope){
	$scope.exports = $scope.data


	$scope.$watch('data',function(){
		var res = [];
		var regexp = /([0-9]{4})([0-9]{2})([0-9]{2})-([0-9]{2})([0-9]{2})([0-9]{2})/;

		angular.forEach($scope.data,function(exp){
			var newExp = {};
			newExp.name = exp;
			var dtMatcher = exp.match(regexp)
			if(dtMatcher){
				newExp.date=dtMatcher[3]+"-"+dtMatcher[2]+"-"+dtMatcher[1]+" "+dtMatcher[4]+":"+dtMatcher[5]+":"+dtMatcher[6]
				res.push(newExp)
			}
		});
		$('#exportTable').dataTable().fnClearTable();
		$('#exportTable').dataTable().fnAddData(res);
		$scope.exports = res;
		return $scope.exports;

	});
}

function PushSettingsController($scope){
	$scope.pushData = {};
	$scope.$on("push-data",function(e,data){
		$scope.pushData = data;
	});
	
	$scope.keyName = function(k){
		return k.replace(/\./g,'');
	}
	
	$scope.isSandboxMode = function(){
		if(!$scope.pushData['push']){
			return false;
		}
		if($scope.pushData['push'][0].value==undefined || 
		   $scope.pushData['push'][0].value=='false'  || 
		   !$scope.pushData['push'][0].value){
			return false;
		}else{
			return true;
		}
	}
	
	$scope.sandboxMode = function(enable){
		var ajaxProps = BBRoutes.com.baasbox.controllers.Admin.setConfiguration('Push',"dummy",$scope.pushData['push'][0].key,'');
		var url = ajaxProps.url.substr(0,ajaxProps.url.length-1).replace('/dummy/','/')
		$.ajax(
				{
		
					method:'PUT',
					type:'PUT',
					contentType:'application/json',
					url: url,
					data:JSON.stringify({value:"true"}),
					error: function(data)
					{
						////console.debug(data)
						alert("Error updating sandbox mode:" + data["message"]);
					},
					success: function(data)
					{
						$scope.$apply(function(){
							
							$scope.pushData['push'][0].value = ""+enable+"";
							//console.debug($scope.pushData['push'][0].value)
						})
						
					}
				});	
	}
	
	$scope.updateInlineSetting = function(section,s){
		//console.debug(s.value)
		s.error = null;
		if(!s.value || s.value==''){
			s.error = "Value can't be empty";
			return;
		}
		var ajaxProps = BBRoutes.com.baasbox.controllers.Admin.setConfiguration(section,"dummy",s.key, '');
		var url = ajaxProps.url.substr(0,ajaxProps.url.length-1).replace('/dummy/','/')
		$.ajax(
				{
					method:'PUT',
					type:'PUT',
					url:url,
					contentType:'application/json',
					url:url,
					data:JSON.stringify({value:s.value}),
					error: function(data)
					{
						////console.debug(data)
						alert("Error updating settings:" + data["message"]);
					},
					success: function(data)
					{
						alert("Setting "+s.key+" saved succesfully")
					}
				});	
	}
	
	
	$scope.updateFileSetting = function(section,s){
		//console.debug("s",$scope[s.key])
		s.error = null;
		if($scope.file==null){
			s.error ="File can't be empty"
			return;
		}
		var serverUrl=BBRoutes.com.baasbox.controllers.Admin.setConfiguration(section,"dummy",s.key, $scope.file.name).absoluteURL();
		if (window.location.protocol == "https:"){
			serverUrl=serverUrl.replace("http:","https:");
		}

		var options = {
				url: serverUrl,
				method:"PUT",
				type: "PUT",
				dataType: "json",
				clearForm: true,
				resetForm: true,
				success: function(){
					alert("File has been uploaded successfully");
					$scope.$apply(function(scope){
						s.filename=$scope.file.name
					});
				}, //success
				error: function(data) {
					alert("There was an error uploading the file.Please check your logs");
					//console.debug(data);
				}
		};
		$('#'+$scope.keyName(s.key)).ajaxSubmit(options);	
		
	}
	
	$scope.setFiles = function(element) {
	    $scope.$apply(function(scope) {
	        scope.file =  element.files[0]
	      });
	    };
}

function DashboardController($scope) {

	$scope.countDocuments = function(statistics){
		var tot=0;
		////console.debug(statistics);
		if (statistics){
			angular.forEach(statistics.data.collections_details, function(value){
				tot += value.records;
			});
		}
		return tot;
	}

	$scope.formatSize = function(size){
		return bytesToSize(size,2);
	}

}



function getPlatform(os){
	function isWindows(OS) {
		return (OS.indexOf("win") >= 0);
	}

	function isMac(OS) {
		return (OS.indexOf("mac") >= 0);
	}

	function isUnix(OS) {
		return (OS.indexOf("nix") >= 0 || OS.indexOf("nux") >= 0 || OS.indexOf("aix") > 0 );
	}

	function  isSolaris(OS) {
		return (OS.indexOf("sunos") >= 0);
	}

	os = os.toLowerCase();
	if (isWindows(os)) {
		return "windows";
	} else if (isMac(os)) {
		return "mac";
	} else if (isUnix(os)) {
		return "unix,linux";
	} else if (isSolaris(os)) {
		return "solaris,unix";
	} else {
		return "other";
	}
}

(function(hasOwnProperty) {
	  /**
	   * Iterates over all of the properties of the specified object and returns an
	   * array of their names.
	   * @param {!Object} obj  The object whose properties will be iterated over.
	   * @param {function(string, *, !Object):*=} fnCallback  Optional function
	   *     callback which, if specified, will be called for each property found.
	   *     The parameters passed will be the name of the property, the value of
	   *     the property and the object.
	   * @return {!Array.<string>}  Returns an array of the names of the properties
	   *     found.  If the fnCallback was specified, the only property names that
	   *     will be returned will be those for which the fnCallback function
	   *     returned a true-ish value.
	   */
	  eachProperty = function(obj, fnCallback) {
	    var ret = [];
	    for(var name in obj) {
	      if(hasOwnProperty.call(obj, name) && (!fnCallback || fnCallback(name, obj[name], obj))) {
	        ret.push(name);
	      }
	    }
	    return ret;
	  };
	})(({}).hasOwnProperty);
