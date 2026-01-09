global using System.Collections.Concurrent;
global using System.ComponentModel;
global using System.ComponentModel.DataAnnotations;
global using System.Net;
global using System.Runtime.CompilerServices;
global using System.Text.Json;
global using System.Text.RegularExpressions;
global using System.Threading.RateLimiting;

global using GeminiDotnet;
global using GeminiDotnet.Extensions.AI;

global using Microsoft.AspNetCore.HttpOverrides;
global using Microsoft.AspNetCore.SignalR;
global using Microsoft.Extensions.AI;
global using Microsoft.Extensions.Options;

global using Scalar.AspNetCore;

global using SketchAI.Api.Configuration;
global using SketchAI.Api.Constants;
global using SketchAI.Api.Dtos;
global using SketchAI.Api.Exceptions;
global using SketchAI.Api.Extensions;
global using SketchAI.Api.Helpers;
global using SketchAI.Api.Hubs;
global using SketchAI.Api.Hubs.Filters;
global using SketchAI.Api.Models;
global using SketchAI.Api.Services.AI;
global using SketchAI.Api.Services.Game;
global using SketchAI.Api.Services.Infrastructure;
global using SketchAI.Api.Validation;

global using StackExchange.Redis;
