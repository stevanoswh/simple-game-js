local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local Players = game:GetService("Players")

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera

local FLY_SPEED = 70

local flying = false
local flyConnection = nil
local keyDown = {}

local function getCharacterParts()
	local character = player.Character or player.CharacterAdded:Wait()
	local humanoid = character:WaitForChild("Humanoid")
	local rootPart = character:WaitForChild("HumanoidRootPart")

	return character, humanoid, rootPart
end

local function hasFlyingPower()
	return player:GetAttribute("CanFly") == true
end

local function getFlyDirection()
	local direction = Vector3.zero

	if keyDown[Enum.KeyCode.W] then
		direction += camera.CFrame.LookVector
	end

	if keyDown[Enum.KeyCode.S] then
		direction -= camera.CFrame.LookVector
	end

	if keyDown[Enum.KeyCode.D] then
		direction += camera.CFrame.RightVector
	end

	if keyDown[Enum.KeyCode.A] then
		direction -= camera.CFrame.RightVector
	end

	if keyDown[Enum.KeyCode.Space] then
		direction += Vector3.new(0, 1, 0)
	end

	if keyDown[Enum.KeyCode.LeftControl] then
		direction -= Vector3.new(0, 1, 0)
	end

	if direction.Magnitude > 0 then
		return direction.Unit
	end

	return Vector3.zero
end

local function startFlying()
	if not hasFlyingPower() then
		print("You need to take the Flying Power Block first!")
		return
	end

	if flying then return end

	local character, humanoid, rootPart = getCharacterParts()

	flying = true
	humanoid.PlatformStand = true

	flyConnection = RunService.RenderStepped:Connect(function()
		if not flying then return end
		if humanoid.Health <= 0 then return end

		local direction = getFlyDirection()
		rootPart.AssemblyLinearVelocity = direction * FLY_SPEED
	end)

	print("Flying ON")
end

local function stopFlying()
	if not flying then return end

	flying = false

	if flyConnection then
		flyConnection:Disconnect()
		flyConnection = nil
	end

	local character, humanoid, rootPart = getCharacterParts()

	humanoid.PlatformStand = false
	rootPart.AssemblyLinearVelocity = Vector3.zero

	print("Flying OFF")
end

UserInputService.InputBegan:Connect(function(input, gameProcessed)
	if gameProcessed then return end

	keyDown[input.KeyCode] = true

	if input.KeyCode == Enum.KeyCode.F then
		if flying then
			stopFlying()
		else
			startFlying()
		end
	end
end)

UserInputService.InputEnded:Connect(function(input)
	keyDown[input.KeyCode] = false
end)

player.CharacterAdded:Connect(function()
	flying = false

	if flyConnection then
		flyConnection:Disconnect()
		flyConnection = nil
	end
end)
