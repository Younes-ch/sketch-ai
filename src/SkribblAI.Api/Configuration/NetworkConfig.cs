namespace SkribblAI.Api.Configuration;

public class NetworkConfig
{
    [Required]
    public string Prefix { get; set; } = "";

    [Range(0, 128)]
    public int PrefixLength { get; set; }
}
