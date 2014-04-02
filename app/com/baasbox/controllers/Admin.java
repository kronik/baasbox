/*
     Copyright 2012-2013 
     Claudio Tesoriero - c.tesoriero-at-baasbox.com

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
 */
package com.baasbox.controllers;

import static play.libs.Json.toJson;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.security.InvalidParameterException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Date;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import org.apache.commons.io.FileUtils;
import org.apache.commons.io.comparator.LastModifiedFileComparator;
import org.apache.commons.lang.StringUtils;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.codehaus.jackson.JsonNode;

import play.Logger;
import play.Play;
import play.libs.Akka;
import play.libs.F.Promise;
import play.libs.Json;
import play.libs.WS;
import play.libs.WS.Response;
import play.mvc.Controller;
import play.mvc.Http;
import play.mvc.Http.Context;
import play.mvc.Http.MultipartFormData;
import play.mvc.Http.MultipartFormData.FilePart;
import play.mvc.Result;
import play.mvc.With;
import scala.concurrent.duration.Duration;

import com.baasbox.BBConfiguration;
import com.baasbox.BBInternalConstants;
import com.baasbox.configuration.IProperties;
import com.baasbox.configuration.Internal;
import com.baasbox.configuration.PropertiesConfigurationHelper;
import com.baasbox.controllers.actions.filters.CheckAdminRoleFilter;
import com.baasbox.controllers.actions.filters.ConnectToDBFilter;
import com.baasbox.controllers.actions.filters.ExtractQueryParameters;
import com.baasbox.controllers.actions.filters.UserCredentialWrapFilter;
import com.baasbox.dao.RoleDao;
import com.baasbox.dao.UserDao;
import com.baasbox.dao.exception.CollectionAlreadyExistsException;
import com.baasbox.dao.exception.InvalidCollectionException;
import com.baasbox.dao.exception.InvalidModelException;
import com.baasbox.dao.exception.SqlInjectionException;
import com.baasbox.db.DbHelper;
import com.baasbox.db.async.ExportJob;
import com.baasbox.enumerations.DefaultRoles;
import com.baasbox.exception.ConfigurationException;
import com.baasbox.exception.RoleAlreadyExistsException;
import com.baasbox.exception.RoleNotFoundException;
import com.baasbox.exception.RoleNotModifiableException;
import com.baasbox.exception.UserNotFoundException;
import com.baasbox.service.storage.CollectionService;
import com.baasbox.service.storage.StatisticsService;
import com.baasbox.service.user.RoleService;
import com.baasbox.service.user.UserService;
import com.baasbox.util.ConfigurationFileContainer;
import com.baasbox.util.IQueryParametersKeys;
import com.baasbox.util.JSONFormats;
import com.baasbox.util.JSONFormats.Formats;
import com.baasbox.util.QueryParams;
import com.baasbox.util.Util;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.base.Objects;
import com.google.common.collect.ImmutableMap;
import com.orientechnologies.orient.core.db.record.ODatabaseRecordTx;
import com.orientechnologies.orient.core.exception.OSerializationException;
import com.orientechnologies.orient.core.index.OIndexException;
import com.orientechnologies.orient.core.metadata.security.ORole;
import com.orientechnologies.orient.core.metadata.security.OUser;
import com.orientechnologies.orient.core.record.impl.ODocument;
import com.orientechnologies.orient.core.serialization.serializer.OJSONWriter;
import com.orientechnologies.orient.core.storage.ORecordDuplicatedException;

@With  ({UserCredentialWrapFilter.class,ConnectToDBFilter.class, CheckAdminRoleFilter.class,ExtractQueryParameters.class})
public class Admin extends Controller {

	static String backupDir = BBConfiguration.getDBBackupDir();
	static String fileSeparator = System.getProperty("file.separator")!=null?System.getProperty("file.separator"):"/";

	public static Result getUsers(){
		if (Logger.isTraceEnabled()) Logger.trace("Method Start");
		Context ctx=Http.Context.current.get();
		QueryParams criteria = (QueryParams) ctx.args.get(IQueryParametersKeys.QUERY_PARAMETERS);
		List<ODocument> users=null;
		String ret="{[]}";
		try{
			users = com.baasbox.service.user.UserService.getUsers(criteria);
		}catch (SqlInjectionException e ){
			return badRequest("The request is malformed: check your query criteria");
		}
		try{
			ret=OJSONWriter.listToJSON(users,JSONFormats.Formats.USER.toString());
		}catch (Throwable e){
			return internalServerError(ExceptionUtils.getFullStackTrace(e));
		}
		if (Logger.isTraceEnabled()) Logger.trace("Method End");
		response().setContentType("application/json");
		return ok(ret);
	}

	public static Result getUser(String username){
		if (Logger.isTraceEnabled()) Logger.trace("Method Start");
		Context ctx=Http.Context.current.get();

		ODocument user=null;
		try {
			user = com.baasbox.service.user.UserService.getUserProfilebyUsername(username);
		} catch (SqlInjectionException e1) {
			return badRequest("The request is malformed: check your query criteria");
		}
		if (user==null) return notFound("User " + username + " not found");
		String ret="";
		try{
			ret=user.toJSON(JSONFormats.Formats.USER.toString());
		}catch (Throwable e){
			return internalServerError(ExceptionUtils.getFullStackTrace(e));
		}
		if (Logger.isTraceEnabled()) Logger.trace("Method End");
		response().setContentType("application/json");
		return ok(ret);
	}

	public static Result getCollections(){
		if (Logger.isTraceEnabled()) Logger.trace("Method Start");

		List<ImmutableMap> result=null;
		try {
			Context ctx=Http.Context.current.get();
			QueryParams criteria = (QueryParams) ctx.args.get(IQueryParametersKeys.QUERY_PARAMETERS);
			List<ODocument> collections = CollectionService.getCollections(criteria);
			result = StatisticsService.collectionsDetails(collections);
		} catch (Exception e){
			Logger.error(ExceptionUtils.getFullStackTrace(e));
			return internalServerError(e.getMessage());
		}
		if (Logger.isTraceEnabled()) Logger.trace("Method End");
		response().setContentType("application/json");
		return ok(toJson(result));
	}

	public static Result createCollection(String name) throws Throwable{
		if (Logger.isTraceEnabled()) Logger.trace("Method Start");
		try{
			CollectionService.create(name);
		}catch (CollectionAlreadyExistsException e) {
			return badRequest(e.getMessage()); 
		}catch (InvalidCollectionException e) {
			return badRequest("The collection name " + name + " is invalid");
		}catch (InvalidModelException e){
			return badRequest(e.getMessage());
		}catch (Throwable e){
			Logger.error(ExceptionUtils.getFullStackTrace(e));
			throw e;
		}
		if (Logger.isTraceEnabled()) Logger.trace("Method End");
		return created();
	}

	public static Result getDBStatistics(){
		ODatabaseRecordTx db = DbHelper.getConnection();
		ImmutableMap response;
		try {
			String bbId = Internal.INSTALLATION_ID.getValueAsString();
			if (bbId==null) bbId="00-00-00"; //--<<--- this prevents an OrientDB bug retrieving keys
			response = ImmutableMap.<String,Object>builder().
					put("installation", (Object)ImmutableMap.of(
							"bb_id",bbId
							,"bb_version", Internal.DB_VERSION.getValueAsString()
							))
							.put("db", StatisticsService.db())
							.put("data",StatisticsService.data())
							.put("os",StatisticsService.os())
							.put("java",StatisticsService.java())
							.put("memory",StatisticsService.memory()).build();

		} catch (SqlInjectionException e) {
			Logger.error (ExceptionUtils.getFullStackTrace(e));
			return internalServerError(e.getMessage());
		} catch (InvalidCollectionException e) {
			Logger.error (ExceptionUtils.getFullStackTrace(e));
			return internalServerError(e.getMessage());
		}
		response().setContentType("application/json");
		return ok(toJson(response));
	}

	public static Result createRole(String name){
		String inheritedRole=DefaultRoles.REGISTERED_USER.toString();
		String description="";
		JsonNode json = request().body().asJson();
		if(json != null) {
			description = Objects.firstNonNull(json.findPath("description").getTextValue(),"");
		}
		try {
			RoleService.createRole(name, inheritedRole, description);
		} catch (RoleNotFoundException e) {
			return badRequest("Role " + inheritedRole + " does not exist. Hint: check the 'inheritedRole' in your payload");
		} catch (RoleAlreadyExistsException e) {
			return badRequest("Role " + name + " already exists");
		}
		return created();
	}

	/**
	 * Edits an existent role.
	 * Only roles that have the modifiable flag set to true can be modified. I.E. only custom roles
	 * The method accepts a JSON payload like this (all fields are optional):
	 * {
	 * 		"newname":"xxx",	//the new name to assign to this role
	 * 		"description:"xxx",	//role description
	 * }
	 * 
	 * @param name the role name to edit
	 * @return
	 */
	public static Result editRole(String name){
		String description="";
		String newName="";
		JsonNode json = request().body().asJson();
		if(json != null) {
			description = json.findPath("description").getTextValue();
			newName = json.findPath("new_name").getTextValue();
		}
		try {
			RoleService.editRole(name, null, description,newName);
		} catch (RoleNotModifiableException e) {
			return badRequest("Role " + name + " is not modifiable");
		} catch (RoleNotFoundException e) {
			return notFound("Role " + name + " does not exists");
		}catch (ORecordDuplicatedException e){
			return badRequest("Role " + name + " already exists");
		} catch (OIndexException e){
			return badRequest("Role " + name + " already exists");
		}
		return ok();
	}


	/**
	 * Delete a Role. Users belonging to that role will be moved to the "registered" role
	 * @param name
	 * @return
	 */

	public static Result deleteRole(String name){
		try {
			RoleService.delete(name);
		} catch (RoleNotFoundException e) {
			return notFound("Role " + name + " does not exist");
		} catch (RoleNotModifiableException e) {
			badRequest("Role " + name + " is not deletable. HINT: maybe you tried to delete an internal role?");
		}
		return ok();
	}

	public static Result getRoles() throws SqlInjectionException{
		List<ODocument> listOfRoles=RoleService.getRoles();
		String ret = OJSONWriter.listToJSON(listOfRoles, JSONFormats.Formats.ROLES.toString());
		response().setContentType("application/json");
		return ok(ret);
	}

	/***
	 * Returns a role details
	 * @param name the role name
	 * @return
	 * @throws SqlInjectionException
	 */
	public static Result getRole(String name) throws SqlInjectionException{
		List<ODocument> listOfRoles=RoleService.getRoles(name);
		if (listOfRoles.size()==0) return notFound("Role " + name + " not found");
		ODocument role = listOfRoles.get(0);
		String ret = role.toJSON(JSONFormats.Formats.ROLES.toString());
		response().setContentType("application/json");
		return ok(ret);
	}

	/* create user in any role */

	public static Result createUser(){
		if (Logger.isTraceEnabled()) Logger.trace("Method Start");
		Http.RequestBody body = request().body();

		JsonNode bodyJson= body.asJson();
		if (Logger.isDebugEnabled()) Logger.debug("signUp bodyJson: " + bodyJson);

		//check and validate input
		if (!bodyJson.has("username"))
			return badRequest("The 'username' field is missing");
		if (!bodyJson.has("password"))
			return badRequest("The 'password' field is missing");		
		if (!bodyJson.has("role"))
			return badRequest("The 'role' field is missing");	

		//extract fields
		JsonNode nonAppUserAttributes = bodyJson.get(UserDao.ATTRIBUTES_VISIBLE_BY_ANONYMOUS_USER);
		JsonNode privateAttributes = bodyJson.get(UserDao.ATTRIBUTES_VISIBLE_ONLY_BY_THE_USER);
		JsonNode friendsAttributes = bodyJson.get(UserDao.ATTRIBUTES_VISIBLE_BY_FRIENDS_USER);
		JsonNode appUsersAttributes = bodyJson.get(UserDao.ATTRIBUTES_VISIBLE_BY_REGISTERED_USER);
		String username=(String) bodyJson.findValuesAsText("username").get(0);
		String password=(String)  bodyJson.findValuesAsText("password").get(0);
		String role=(String)  bodyJson.findValuesAsText("role").get(0);

		if (privateAttributes!=null && privateAttributes.has("email")) {
			//check if email address is valid
			if (!Util.validateEmail((String) (String) privateAttributes.findValuesAsText("email").get(0)) )
				return badRequest("The email address must be valid.");
		}

		//try to signup new user
		try {
			UserService.signUp(username, password, null,role,nonAppUserAttributes, privateAttributes, friendsAttributes, appUsersAttributes,false);
		}catch(InvalidParameterException e){
			return badRequest(e.getMessage());  
		}catch (OSerializationException e){
			return badRequest("Body is not a valid JSON: " + e.getMessage() + "\nyou sent:\n" + bodyJson.toString() + 
					"\nHint: check the fields "+UserDao.ATTRIBUTES_VISIBLE_BY_ANONYMOUS_USER+
					", " + UserDao.ATTRIBUTES_VISIBLE_ONLY_BY_THE_USER+
					", " + UserDao.ATTRIBUTES_VISIBLE_BY_FRIENDS_USER  + 
					", " + UserDao.ATTRIBUTES_VISIBLE_BY_REGISTERED_USER+
					" they must be an object, not a value.");
		}catch (Exception e) {
			Logger.error(ExceptionUtils.getFullStackTrace(e));
			throw new RuntimeException(e) ;
		}
		if (Logger.isTraceEnabled()) Logger.trace("Method End");
		return created();
	}//createUser


	public static Result updateUser(String username){
		if (Logger.isTraceEnabled()) Logger.trace("Method Start");
		Http.RequestBody body = request().body();

		JsonNode bodyJson= body.asJson();
		if (Logger.isDebugEnabled()) Logger.debug("signUp bodyJson: " + bodyJson);

		if (!bodyJson.has("role"))
			return badRequest("The 'role' field is missing");	

		//extract fields
		String missingField = null;
		JsonNode nonAppUserAttributes;
		JsonNode privateAttributes;
		JsonNode friendsAttributes;
		JsonNode appUsersAttributes;
		try{
			missingField = UserDao.ATTRIBUTES_VISIBLE_BY_ANONYMOUS_USER;
			nonAppUserAttributes = bodyJson.get(UserDao.ATTRIBUTES_VISIBLE_BY_ANONYMOUS_USER);
			if(nonAppUserAttributes==null){
				throw new IllegalArgumentException(missingField);
			}
			missingField = UserDao.ATTRIBUTES_VISIBLE_ONLY_BY_THE_USER;
			privateAttributes = bodyJson.get(UserDao.ATTRIBUTES_VISIBLE_ONLY_BY_THE_USER);
			if(privateAttributes==null){
				throw new IllegalArgumentException(missingField);
			}
			missingField = UserDao.ATTRIBUTES_VISIBLE_BY_FRIENDS_USER;
			friendsAttributes = bodyJson.get(UserDao.ATTRIBUTES_VISIBLE_BY_FRIENDS_USER);
			if(friendsAttributes==null){
				throw new IllegalArgumentException(missingField);
			}
			missingField = UserDao.ATTRIBUTES_VISIBLE_BY_REGISTERED_USER;
			appUsersAttributes = bodyJson.get(UserDao.ATTRIBUTES_VISIBLE_BY_REGISTERED_USER);
			if(appUsersAttributes==null){
				throw new IllegalArgumentException(missingField);
			}

		}catch(Exception npe){
			return badRequest("The '"+ missingField+"' field is missing");
		}
		String role=(String)  bodyJson.findValuesAsText("role").get(0);

		if (privateAttributes.has("email")) {
			//check if email address is valid
			if (!Util.validateEmail((String) (String) privateAttributes.findValuesAsText("email").get(0)) )
				return badRequest("The email address must be valid.");
		}

		ODocument user=null;
		//try to update new user
		try {
			user=UserService.updateProfile(username,role,nonAppUserAttributes, privateAttributes, friendsAttributes, appUsersAttributes);
		}catch(InvalidParameterException e){
			return badRequest(e.getMessage());  
		}catch (OSerializationException e){
			return badRequest("Body is not a valid JSON: " + e.getMessage() + "\nyou sent:\n" + bodyJson.toString() + 
					"\nHint: check the fields "+UserDao.ATTRIBUTES_VISIBLE_BY_ANONYMOUS_USER+
					", " + UserDao.ATTRIBUTES_VISIBLE_ONLY_BY_THE_USER+
					", " + UserDao.ATTRIBUTES_VISIBLE_BY_FRIENDS_USER  + 
					", " + UserDao.ATTRIBUTES_VISIBLE_BY_REGISTERED_USER+
					" they must be an object, not a value.");
		}catch (Throwable e){
			Logger.warn("signUp", e);
			if (Play.isDev()) return internalServerError(ExceptionUtils.getFullStackTrace(e));
			else return internalServerError(e.getMessage());
		}
		if (Logger.isTraceEnabled()) Logger.trace("Method End");
		return ok(user.toJSON(Formats.USER.toString()));
	}//updateUser

	/***
	 * Change password of a specific user
	 * @param name of user
	 * @return 
	 * @throws UserNotFoundException 
	 * @throws SqlInjectionException 
	 */
	public static Result changePassword(String username) throws SqlInjectionException, UserNotFoundException{
		if (Logger.isTraceEnabled()) Logger.trace("Method Start");
		Http.RequestBody body = request().body();
		JsonNode bodyJson= body.asJson(); //{"password":"Password"}
		if (Logger.isTraceEnabled()) Logger.trace("changePassword bodyJson: " + bodyJson);
		
		if (bodyJson==null) return badRequest("The body payload cannot be empty.");		  
		JsonNode passwordNode=bodyJson.findValue("password");
		
		if (passwordNode==null) return badRequest("The body payload doesn't contain password field");
		String password=passwordNode.asText();	  
		
		try{
			UserService.changePassword(username, password);
		} catch (UserNotFoundException e) {
		    Logger.error("Username not found " + username, e);
		    return notFound("Username not found");
		}
		if (Logger.isTraceEnabled()) Logger.trace("Method End");
		return ok();	
	}

	
	

	public static Result dropUser(){
		return status(NOT_IMPLEMENTED);
	}

	/***
	 * Drop an entire collection
	 * Data are lost... forever
	 * @param name the Collection to drop
	 * @return
	 */
	public static Result dropCollection(String name){
		if (Logger.isTraceEnabled()) Logger.trace("Method Start");
		try {
			CollectionService.drop(name);
		}catch (SqlInjectionException e){
			return badRequest("The Collection name "+ name +" is malformed or invalid.");
		}catch (InvalidCollectionException e){
			return notFound("The Collection " + name + " does not exist");
		}catch (Exception e){
			Logger.error(ExceptionUtils.getFullStackTrace(e));
			return internalServerError(e.getMessage());
		}
		if (Logger.isTraceEnabled()) Logger.trace("Method End");
		response().setContentType("application/json");
		return ok();
	}



	public static Result deleteDocument(){
		return status(NOT_IMPLEMENTED);
	}

	public static Result dumpConfiguration(String returnType){
		String dump="";
		if (returnType.equals("txt")) {
			dump= PropertiesConfigurationHelper.dumpConfiguration();
			response().setContentType("application/text");
		}else if (returnType.equals("json")){
			dump = PropertiesConfigurationHelper.dumpConfigurationAsJson();
			response().setContentType("application/json");
		}
		return ok(dump);
	}


	public static Result setConfiguration(String section, String subSection, String key, String value){
		Class conf = PropertiesConfigurationHelper.CONFIGURATION_SECTIONS.get(section);
		if (conf==null) return notFound(section + " is not a valid configuration section");
		try {
			IProperties i = (IProperties)PropertiesConfigurationHelper.findByKey(conf, key);
			if(i.getType().equals(ConfigurationFileContainer.class)){
				MultipartFormData  body = request().body().asMultipartFormData();
				if (body==null) return badRequest("missing data: is the body multipart/form-data?");
				FilePart file = body.getFile("file");
				if(file==null) return badRequest("missing file");
				ByteArrayOutputStream baos = new ByteArrayOutputStream();
				try{
					FileUtils.copyFile(file.getFile(),baos);
					Object fileValue = new ConfigurationFileContainer(file.getFilename(), baos.toByteArray());
					baos.close();
					conf.getMethod("setValue",Object.class).invoke(i,fileValue);
				}catch(Exception e){
					internalServerError(e.getMessage());
				}
			}else{
				PropertiesConfigurationHelper.setByKey(conf, key, value);
			}
		} catch (ConfigurationException e) {
			return badRequest(e.getMessage());
		}catch (IllegalStateException e) {
			return badRequest("This configuration value is not editable");
		}
		return ok();
	}

	public static Result getConfiguration(String section) throws  Throwable{
		response().setContentType("application/json");
		return ok(PropertiesConfigurationHelper.dumpConfigurationSectionAsFlatJson(section));
	}

	public static Result getLatestVersion() {
		String urlToCall="http://www.baasbox.com/version/"+ Internal.INSTALLATION_ID.getValueAsString() + "/";
		if (Logger.isDebugEnabled()) Logger.debug("Calling " + urlToCall);
		try{
			final Promise<Response> promise = WS.url(urlToCall).get();
			return status(promise.get().getStatus(),promise.get().getBody());
		}catch(Exception e){
			Logger.warn("Could not reach BAASBOX site to check for new versions");
		}
		return status(503,"Could not reach BAASBOX site to check for new versions");
	}//getLatestVersion


	public static Result dropDb(Long timeout){
		Result r = null;
		try{
			DbHelper.shutdownDB(true);
			if(timeout>0){
				Logger.info(String.format("Sleeping for %d seconds",timeout/1000));
				Thread.sleep(timeout);
			}
			r = ok();
		}catch(Exception e){
			Logger.error(e.getMessage());
			r = internalServerError(e.getMessage());
		}
		return r;
	}


	/**
	 * /admin/db/export (POST)
	 * 
	 * the method generate a full dump of the db in an asyncronus task.
	 * the response returns a 202 code (ACCEPTED) and the filename of the
	 * file that will be generated.
	 * 
	 * The async nature of the method DOES NOT ensure the creation of the file
	 * so, querying for the file name with the /admin/db/:filename could return a 404
	 * @return a 202 accepted code and a json representation containing the filename of the generated file
	 */
	public static Result exportDb(){
		String appcode = (String)ctx().args.get("appcode");

		if(appcode == null || StringUtils.isEmpty(appcode.trim())){
			unauthorized("appcode can not be null");
		}

		java.io.File dir = new java.io.File(backupDir);
		if(!dir.exists()){
			boolean createdDir = dir.mkdirs();
			if(!createdDir){
				return internalServerError("unable to create backup dir");
			}
		}
		SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMdd-HHmmss");
		String fileName = String.format("%s-%s.zip", sdf.format(new Date()),appcode);
		//Async task
		Akka.system().scheduler().scheduleOnce(
				Duration.create(2, TimeUnit.SECONDS),
				new ExportJob(dir.getAbsolutePath()+fileSeparator+fileName,appcode),
				Akka.system().dispatcher()
				); 
		return status(202,Json.toJson(fileName));

	}

	/**
	 * /admin/db/export/:filename (GET)
	 * 
	 * the method returns the stream of the export file named after :filename parameter. 
	 * 
	 * if the file is not present a 404 code is returned to the client
	 * 
	 * @return a 200 ok code and the stream of the file
	 */
	public static Result getExport(String fileName){
		java.io.File file = new java.io.File(backupDir+fileSeparator+fileName);
		if(!file.exists()){
			return notFound();
		}else{
			return ok(file);
		}

	}

	/**
	 * /admin/db/export/:filename (DELETE)
	 * 
	 * Deletes an export file from the db backup folder, if it exists 
	 * 
	 * 
	 * @param fileName the name of the file to be deleted
	 * @return a 200 code if the file is deleted correctly or a 404.If the file could not
	 * be deleted a 500 error code is returned
	 */
	public static Result deleteExport(String fileName){
		java.io.File file = new java.io.File(backupDir+fileSeparator+fileName);
		if(!file.exists()){
			return notFound();
		}else{
			boolean deleted = false;
			try{
				FileUtils.forceDelete(file);
				deleted =true;
			}catch(IOException e){
				deleted = file.delete();
				if(deleted==false){
					file.deleteOnExit();

				}
			}
			if(deleted){
				return ok();
			}else{
				return internalServerError("Unable to delete export.It will be deleted on the next reboot."+fileName);
			}
		}

	}

	/**
	 * /admin/db/export (GET)
	 * 
	 * the method returns the list as a json array of all the export files
	 * stored into the db export folder ({@link BBConfiguration#getDBBackupDir()})
	 * 
	 * @return a 200 ok code and a json representation containing the list of files stored in the db backup folder
	 */
	public static Result getExports(){
		java.io.File dir = new java.io.File(backupDir);
		if(!dir.exists()){
			dir.mkdirs();
		}
		Collection<java.io.File> files = FileUtils.listFiles(dir, new String[]{"zip"},false);
		File[] fileArr = files.toArray(new File[files.size()]);

		Arrays.sort(fileArr,LastModifiedFileComparator.LASTMODIFIED_REVERSE);

		List<String> fileNames = new ArrayList<String>();
		for (java.io.File file : fileArr) {
			fileNames.add(file.getName());
		}
		return ok(Json.toJson(fileNames));

	}

	/**
	 * /admin/db/import (POST)
	 * 
	 * the method allows to upload a json export file and apply it to the db.
	 * WARNING: all data on the db will be wiped out before importing
	 * 
	 * @return a 200 Status code when the import is successfull,a 500 status code otherwise
	 */
	public static Result importDb(){
		String appcode = (String)ctx().args.get("appcode");
		if(appcode == null || StringUtils.isEmpty(appcode.trim())){
			unauthorized("appcode can not be null");
		}


		MultipartFormData  body = request().body().asMultipartFormData();
		if (body==null) return badRequest("missing data: is the body multipart/form-data?");
		FilePart fp = body.getFile("file");

		if (fp!=null){
			ZipInputStream zis = null;
			String fileContent = null;
			try{
				java.io.File multipartFile=fp.getFile();
				java.util.UUID uuid = java.util.UUID.randomUUID();
				File zipFile = File.createTempFile(uuid.toString(), ".zip");
				FileUtils.copyFile(multipartFile,zipFile);
				zis = 
						new ZipInputStream(new FileInputStream(zipFile));
				//get the zipped file list entry
				ZipEntry ze = zis.getNextEntry();
				if(ze.isDirectory()){
					ze = zis.getNextEntry();
				}
				if(ze!=null){
					File newFile = File.createTempFile("export",".json");
					FileOutputStream fout = new FileOutputStream(newFile);
					for (int c = zis.read(); c != -1; c = zis.read()) {
						fout.write(c);
					}
					fout.close();
					fileContent = FileUtils.readFileToString(newFile);
					newFile.delete();
				}else{
					return badRequest("Looks like the uploaded file is not a valid export.");
				}
				ZipEntry manifest = zis.getNextEntry();
				if(manifest!=null){
					File manifestFile = File.createTempFile("manifest",".txt");
					FileOutputStream fout = new FileOutputStream(manifestFile);
					for (int c = zis.read(); c != -1; c = zis.read()) {
						fout.write(c);
					}
					fout.close();
					String manifestContent  = FileUtils.readFileToString(manifestFile);
					manifestFile.delete();
					Pattern p = Pattern.compile(BBInternalConstants.IMPORT_MANIFEST_VERSION_PATTERN);
					Matcher m = p.matcher(manifestContent);
					if(m.matches()){
						String version = m.group(1);
						if (version.compareToIgnoreCase("0.6.0")<0){ //we support imports from version 0.6.0
							return badRequest(String.format("Current baasbox version(%s) is not compatible with import file version(%s)",BBConfiguration.getApiVersion(),version));
						}else{
							if (Logger.isDebugEnabled()) Logger.debug("Version : "+version+" is valid");
						}
					}else{
						return badRequest("The manifest file does not contain a version number");
					}
				}else{
					return badRequest("Looks like zip file does not contain a manifest file");
				}
				if (Logger.isDebugEnabled()) Logger.debug("Importing: "+fileContent);
				if(fileContent!=null && StringUtils.isNotEmpty(fileContent.trim())){
					DbHelper.importData(appcode, fileContent);
					zis.closeEntry();
					zis.close();
					zipFile.delete();
					return ok();
				}else{
					return badRequest("The import file is empty");
				}
			}catch(Exception e){
				Logger.error(e.getMessage());
				return internalServerError("There was an error handling your zip import file.");
			}finally{
				try {
					if(zis!=null){
						zis.close();
					}
				} catch (IOException e) {
					// Nothing to do here
				}
			}
		}else{
			return badRequest("The form was submitted without a multipart file field.");
		}
	}//importDb



	/***
	 * /admin/user/suspend/:username (PUT)
	 * 
	 * @param username
	 * @return
	 */
	public static Result disable(String username){
		if (username.equalsIgnoreCase(BBConfiguration.getBaasBoxAdminUsername()) || 
				username.equalsIgnoreCase(BBConfiguration.getBaasBoxUsername()))
			return badRequest("Cannot disable/suspend internal users");
		try {
			UserService.disableUser(username);
		} catch (UserNotFoundException e) {
			return badRequest(e.getMessage());
		}
		return ok();
	}

	/***
	 * /admin/user/activate/:username (PUT)
	 * 
	 * @param username
	 * @return
	 */
	public static Result enable(String username){
		if (username.equalsIgnoreCase(BBConfiguration.getBaasBoxAdminUsername()) || 
				username.equalsIgnoreCase(BBConfiguration.getBaasBoxUsername()))
			return badRequest("Cannot enable/activate internal users");
		try {
			UserService.enableUser(username);
		} catch (UserNotFoundException e) {
			return badRequest(e.getMessage());
		}
		return ok();
	}
	
	/**
	 * POST /admin/Fw/:follower/to/:tofollow
	 * Create a follow relationship beetwen user follower and user to follow
	 * @param follower
	 * @param theFollowed
	 * @return
	 */
	public static Result createFollowRelationship(String follower,String theFollowed){
		/**
		 * Test if the usernames provided do not match internal users' usernames 
		 */
		if ((follower.equalsIgnoreCase(BBConfiguration.getBaasBoxAdminUsername()) || 
				follower.equalsIgnoreCase(BBConfiguration.getBaasBoxUsername())) || 
				(theFollowed.equalsIgnoreCase(BBConfiguration.getBaasBoxAdminUsername()) || 
						theFollowed.equalsIgnoreCase(BBConfiguration.getBaasBoxUsername())))
			return badRequest("Cannot create followship relationship with internal users");

		boolean firstUserExists = UserService.exists(follower);
		boolean secondUserExists = UserService.exists(theFollowed);
		if(firstUserExists && secondUserExists){
			String friendshipRole = RoleDao.FRIENDS_OF_ROLE +theFollowed;
			if(RoleService.hasRole(follower, friendshipRole)){
				return badRequest("User "+follower+" is already a friend of "+theFollowed);
			}
			try{
				UserService.addUserToRole(follower,friendshipRole);
				return created();
			}catch(Exception e){
				return internalServerError(e.getMessage());
			}
			
		}else{
			StringBuilder errorString = new StringBuilder("The user");
			if(!firstUserExists && !secondUserExists){
				errorString = new StringBuilder("Both the users do not exists in the db.");
				return notFound(errorString.toString());
			}
			if(!firstUserExists){
				errorString.append(" ").append(follower).append(" ");
			}
			if(!secondUserExists){
				errorString.append(" ").append(theFollowed).append(" ");
			}
			errorString.append(" does not exists on the db");
			return notFound(errorString.toString());


		}
	}
	
	/**
	 * DELETE /admin/follow/:follower/to/:tofollow
	 * Delete a follow relationship beetwen user follower and user to follow
	 * @param follower
	 * @param toFollow
	 * @return
	 */
	public static Result removeFollowRelationship(String follower,String theFollowed){
		/**
		 * Test if the usernames provided do not match internal users' usernames 
		 */
		boolean firstUserExists = UserService.exists(follower);
		boolean secondUserExists = UserService.exists(theFollowed);
		if(firstUserExists && secondUserExists){
			String friendshipRole = RoleDao.FRIENDS_OF_ROLE +theFollowed;
			if(!RoleService.hasRole(follower, friendshipRole)){
				return notFound("User "+follower+" is not a friend of "+theFollowed);
			}
			try{
				UserService.removeUserFromRole(follower,friendshipRole);
				return ok();
			}catch(Exception e){
				return internalServerError(e.getMessage());
			}
			
		}else{
			StringBuilder errorString = new StringBuilder("The user");
			if(!firstUserExists && !secondUserExists){
				errorString = new StringBuilder("Both the users do not exists in the db.");
				return notFound(errorString.toString());
			}
			if(!firstUserExists){
				errorString.append(" ").append(follower).append(" ");
			}
			if(!secondUserExists){
				errorString.append(" ").append(theFollowed).append(" ");
			}
			errorString.append(" does not exists on the db");
			return notFound(errorString.toString());


		}
	}
	
	public static Result following(String username){
		if(!UserService.exists(username)){
			return notFound("User "+username+" does not exists");
		}
		 OUser user = UserService.getOUserByUsername(username);
		 Set<ORole> roles = user.getRoles();
		 List<String> usernames = new ArrayList<String>();
		 for (ORole oRole : roles) {
			  
			if(oRole.getName().startsWith(RoleDao.FRIENDS_OF_ROLE)){
				usernames.add(StringUtils.difference(RoleDao.FRIENDS_OF_ROLE,oRole.getName()));
			}
		 }
		 if(usernames.isEmpty()){
			 return notFound();
		 }else{
			 List<ODocument> followers;
			try {
				followers = UserService.getUserProfilebyUsernames(usernames);
				return ok(User.prepareResponseToJson(followers));
			} catch (Exception e) {
				Logger.error(e.getMessage());
				return internalServerError(e.getMessage());
			}
		 }
	}

}
