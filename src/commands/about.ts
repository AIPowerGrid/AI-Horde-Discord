import { Colors, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Command } from "../classes/command";
import { CommandContext } from "../classes/commandContext";

const command_data = new SlashCommandBuilder()
    .setName("about")
    .setDMPermission(false)
    .setDescription(`Shows information about this bot`)

export default class extends Command {
    constructor() {
        super({
            name: "about",
            command_data: command_data.toJSON(),
            staff_only: false,
        })
    }

    override async run(ctx: CommandContext): Promise<any> {
        //const counts = await ctx.database?.query("SELECT (SELECT COUNT(*) FROM user_tokens) as user_tokens, (SELECT COUNT(*) FROM parties) as parties, (SELECT COUNT(*) FROM pending_kudos) as pending_kudos").then(res => res.rows[0]).catch(console.error)

        const embed = new EmbedBuilder({
            color: Colors.Blue,
            title: "Unofficial AI Grid Discord Bot",
            description: `This Discord Bot was made by Zelda_Fan#0225 and adapted by mrschmiklz to the Grid`
        })
        return ctx.interaction.reply({
            embeds: [embed],
            ephemeral: true
        })
    }
}